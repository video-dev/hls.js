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
 * Buffer Controller
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

var _observer = require('../observer');

var _observer2 = _interopRequireDefault(_observer);

var _utilsLogger = require('../utils/logger');

var _demuxDemuxer = require('../demux/demuxer');

var _demuxDemuxer2 = _interopRequireDefault(_demuxDemuxer);

var _errors = require('../errors');

var BufferController = (function () {
  function BufferController(hls) {
    _classCallCheck(this, BufferController);

    this.ERROR = -2;
    this.STARTING = -1;
    this.IDLE = 0;
    this.LOADING = 1;
    this.WAITING_LEVEL = 2;
    this.PARSING = 3;
    this.PARSED = 4;
    this.APPENDING = 5;
    this.BUFFER_FLUSHING = 6;
    this.config = hls.config;
    this.startPosition = 0;
    this.hls = hls;
    // Source Buffer listeners
    this.onsbue = this.onSourceBufferUpdateEnd.bind(this);
    this.onsbe = this.onSourceBufferError.bind(this);
    // internal listeners
    this.onmse = this.onMSEAttached.bind(this);
    this.onmsed = this.onMSEDetached.bind(this);
    this.onmp = this.onManifestParsed.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onis = this.onInitSegment.bind(this);
    this.onfpg = this.onFragmentParsing.bind(this);
    this.onfp = this.onFragmentParsed.bind(this);
    this.onerr = this.onError.bind(this);
    this.ontick = this.tick.bind(this);
    _observer2['default'].on(_events2['default'].MSE_ATTACHED, this.onmse);
    _observer2['default'].on(_events2['default'].MSE_DETACHED, this.onmsed);
    _observer2['default'].on(_events2['default'].MANIFEST_PARSED, this.onmp);
  }

  _createClass(BufferController, [{
    key: 'destroy',
    value: function destroy() {
      this.stop();
      _observer2['default'].off(_events2['default'].MANIFEST_PARSED, this.onmp);
      // remove video listener
      if (this.video) {
        this.video.removeEventListener('seeking', this.onvseeking);
        this.video.removeEventListener('seeked', this.onvseeked);
        this.video.removeEventListener('loadedmetadata', this.onvmetadata);
        this.video.removeEventListener('ended', this.onvended);
        this.onvseeking = this.onvseeked = this.onvmetadata = null;
      }
      this.state = this.IDLE;
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      if (this.levels && this.video) {
        this.startInternal();
        if (this.lastCurrentTime) {
          _utilsLogger.logger.log('seeking @ ' + this.lastCurrentTime);
          this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
          if (!this.lastPaused) {
            _utilsLogger.logger.log('resuming video');
            this.video.play();
          }
          this.state = this.IDLE;
        } else {
          this.nextLoadPosition = this.startPosition;
          this.state = this.STARTING;
        }
        this.tick();
      } else {
        _utilsLogger.logger.warn('cannot start loading as either manifest not parsed or video not attached');
      }
    }
  }, {
    key: 'startInternal',
    value: function startInternal() {
      this.stop();
      this.demuxer = new _demuxDemuxer2['default'](this.config);
      this.timer = setInterval(this.ontick, 100);
      this.level = -1;
      _observer2['default'].on(_events2['default'].FRAG_LOADED, this.onfl);
      _observer2['default'].on(_events2['default'].FRAG_PARSING_INIT_SEGMENT, this.onis);
      _observer2['default'].on(_events2['default'].FRAG_PARSING_DATA, this.onfpg);
      _observer2['default'].on(_events2['default'].FRAG_PARSED, this.onfp);
      _observer2['default'].on(_events2['default'].ERROR, this.onerr);
      _observer2['default'].on(_events2['default'].LEVEL_LOADED, this.onll);
    }
  }, {
    key: 'stop',
    value: function stop() {
      this.mp4segments = [];
      this.flushRange = [];
      this.bufferRange = [];
      if (this.frag) {
        if (this.frag.loader) {
          this.frag.loader.abort();
        }
        this.frag = null;
      }
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
      _observer2['default'].off(_events2['default'].FRAG_LOADED, this.onfl);
      _observer2['default'].off(_events2['default'].FRAG_PARSED, this.onfp);
      _observer2['default'].off(_events2['default'].FRAG_PARSING_DATA, this.onfpg);
      _observer2['default'].off(_events2['default'].LEVEL_LOADED, this.onll);
      _observer2['default'].off(_events2['default'].FRAG_PARSING_INIT_SEGMENT, this.onis);
      _observer2['default'].off(_events2['default'].ERROR, this.onerr);
    }
  }, {
    key: 'tick',
    value: function tick() {
      var pos, level, levelDetails, fragIdx;
      switch (this.state) {
        case this.ERROR:
          //don't do anything in error state to avoid breaking further ...
          break;
        case this.STARTING:
          // determine load level
          this.startLevel = this.hls.startLevel;
          if (this.startLevel === -1) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            this.startLevel = 0;
            this.fragmentBitrateTest = true;
          }
          // set new level to playlist loader : this will trigger start level load
          this.level = this.hls.nextLoadLevel = this.startLevel;
          this.state = this.WAITING_LEVEL;
          this.loadedmetadata = false;
          break;
        case this.IDLE:
          // handle end of immediate switching if needed
          if (this.immediateSwitch) {
            this.immediateLevelSwitchEnd();
            break;
          }
          // if video detached or unbound exit loop
          if (!this.video) {
            break;
          }
          // seek back to a expected position after video stalling
          if (this.seekAfterStalling) {
            this.video.currentTime = this.seekAfterStalling;
            this.seekAfterStalling = undefined;
          }
          // determine next candidate fragment to be loaded, based on current position and
          //  end of buffer position
          //  ensure 60s of buffer upfront
          // if we have not yet loaded any fragment, start loading from start position
          if (this.loadedmetadata) {
            pos = this.video.currentTime;
          } else {
            pos = this.nextLoadPosition;
          }
          // determine next load level
          if (this.startFragmentRequested === false) {
            level = this.startLevel;
          } else {
            // we are not at playback start, get next load level from level Controller
            level = this.hls.nextLoadLevel;
          }
          var bufferInfo = this.bufferInfo(pos),
              bufferLen = bufferInfo.len,
              bufferEnd = bufferInfo.end,
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
            this.hls.nextLoadLevel = level;
            this.level = level;
            levelDetails = this.levels[level].details;
            // if level info not retrieved yet, switch state and wait for level retrieval
            if (typeof levelDetails === 'undefined') {
              this.state = this.WAITING_LEVEL;
              break;
            }
            // find fragment index, contiguous with end of buffer position
            var fragments = levelDetails.fragments,
                _frag = undefined,
                sliding = levelDetails.sliding,
                start = fragments[0].start + sliding,
                drift = 0;
            // check if requested position is within seekable boundaries :
            // in case of live playlist we need to ensure that requested position is not located before playlist start
            //logger.log(`start/pos/bufEnd/seeking:${start.toFixed(3)}/${pos.toFixed(3)}/${bufferEnd.toFixed(3)}/${this.video.seeking}`);
            if (bufferEnd < start) {
              this.seekAfterStalling = this.startPosition + sliding;
              _utilsLogger.logger.log('buffer end: ' + bufferEnd + ' is located before start of live sliding playlist, media position will be reseted to: ' + this.seekAfterStalling.toFixed(3));
              bufferEnd = this.seekAfterStalling;
            }
            if (levelDetails.live && levelDetails.sliding === undefined) {
              /* we are switching level on live playlist, but we don't have any sliding info ...
                 try to load frag matching with next SN.
                 even if SN are not synchronized between playlists, loading this frag will help us
                 compute playlist sliding and find the right one after in case it was not the right consecutive one */
              if (this.frag) {
                var targetSN = this.frag.sn + 1;
                if (targetSN >= levelDetails.startSN && targetSN <= levelDetails.endSN) {
                  _frag = fragments[targetSN - levelDetails.startSN];
                  _utilsLogger.logger.log('live playlist, switching playlist, load frag with next SN: ' + _frag.sn);
                }
              }
              if (!_frag) {
                /* we have no idea about which fragment should be loaded.
                   so let's load mid fragment. it will help computing playlist sliding and find the right one
                */
                _frag = fragments[Math.round(fragments.length / 2)];
                _utilsLogger.logger.log('live playlist, switching playlist, unknown, load middle frag : ' + _frag.sn);
              }
            } else {
              //look for fragments matching with current play position
              for (fragIdx = 0; fragIdx < fragments.length; fragIdx++) {
                _frag = fragments[fragIdx];
                start = _frag.start + sliding;
                if (_frag.drift) {
                  drift = _frag.drift;
                }
                start += drift;
                //logger.log('level/sn/sliding/drift/start/end/bufEnd:${level}/${frag.sn}/${sliding.toFixed(3)}/${drift.toFixed(3)}/${start.toFixed(3)}/${(start+frag.duration).toFixed(3)}/${bufferEnd.toFixed(3)}');
                // offset should be within fragment boundary
                if (start <= bufferEnd && start + _frag.duration > bufferEnd) {
                  break;
                }
              }
              if (fragIdx === fragments.length) {
                // reach end of playlist
                break;
              }
              //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
              if (this.frag && _frag.sn === this.frag.sn) {
                if (fragIdx === fragments.length - 1) {
                  // we are at the end of the playlist and we already loaded last fragment, don't do anything
                  break;
                } else {
                  _frag = fragments[fragIdx + 1];
                  _utilsLogger.logger.log('SN just loaded, load next one: ' + _frag.sn);
                }
              }
            }
            _utilsLogger.logger.log('Loading ' + _frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level + ', currentTime:' + pos + ',bufferEnd:' + bufferEnd.toFixed(3));
            //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
            _frag.drift = drift;
            _frag.autoLevel = this.hls.autoLevelEnabled;
            if (this.levels.length > 1) {
              _frag.expectedLen = Math.round(_frag.duration * this.levels[level].bitrate / 8);
              _frag.trequest = new Date();
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
                _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR, fatal: false, frag: _frag });
                return;
              }
            } else {
              _frag.loadCounter = 1;
            }
            _frag.loadIdx = this.fragLoadIdx;
            this.frag = _frag;
            this.startFragmentRequested = true;
            _observer2['default'].trigger(_events2['default'].FRAG_LOADING, { frag: _frag });
            this.state = this.LOADING;
          }
          break;
        case this.WAITING_LEVEL:
          level = this.levels[this.level];
          // check if playlist is already loaded
          if (level && level.details) {
            this.state = this.IDLE;
          }
          break;
        case this.LOADING:
          /*
            monitor fragment retrieval time...
            we compute expected time of arrival of the complete fragment.
            we compare it to expected time of buffer starvation
          */
          var v = this.video,
              frag = this.frag;
          /* only monitor frag retrieval time if
          (video not paused OR first fragment being loaded) AND autoswitching enabled AND not lowest level AND multiple levels */
          if (v && (!v.paused || this.loadedmetadata === false) && frag.autoLevel && this.level && this.levels.length > 1) {
            var requestDelay = new Date() - frag.trequest;
            // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
            if (requestDelay > 500 * frag.duration) {
              var loadRate = frag.loaded * 1000 / requestDelay; // byte/s
              if (frag.expectedLen < frag.loaded) {
                frag.expectedLen = frag.loaded;
              }
              pos = v.currentTime;
              var fragLoadedDelay = (frag.expectedLen - frag.loaded) / loadRate;
              var bufferStarvationDelay = this.bufferInfo(pos).end - pos;
              var fragLevelNextLoadedDelay = frag.duration * this.levels[this.hls.nextLoadLevel].bitrate / (8 * loadRate); //bps/Bps
              /* if we have less than 2 frag duration in buffer and if frag loaded delay is greater than buffer starvation delay
                ... and also bigger than duration needed to load fragment at next level ...*/
              if (bufferStarvationDelay < 2 * frag.duration && fragLoadedDelay > bufferStarvationDelay && fragLoadedDelay > fragLevelNextLoadedDelay) {
                // abort fragment loading ...
                _utilsLogger.logger.warn('loading too slow, abort fragment loading');
                _utilsLogger.logger.log('fragLoadedDelay/bufferStarvationDelay/fragLevelNextLoadedDelay :' + fragLoadedDelay.toFixed(1) + '/' + bufferStarvationDelay.toFixed(1) + '/' + fragLevelNextLoadedDelay.toFixed(1));
                //abort fragment loading
                frag.loader.abort();
                this.frag = null;
                _observer2['default'].trigger(_events2['default'].FRAG_LOAD_EMERGENCY_ABORTED, { frag: frag });
                // switch back to IDLE state to request new fragment at lowest level
                this.state = this.IDLE;
              }
            }
          }
          break;
        case this.PARSING:
          // nothing to do, wait for fragment being parsed
          break;
        case this.PARSED:
        case this.APPENDING:
          if (this.sourceBuffer) {
            // if MP4 segment appending in progress nothing to do
            if (this.sourceBuffer.audio && this.sourceBuffer.audio.updating || this.sourceBuffer.video && this.sourceBuffer.video.updating) {
              //logger.log('sb append in progress');
              // check if any MP4 segments left to append
            } else if (this.mp4segments.length) {
                var segment = this.mp4segments.shift();
                try {
                  //logger.log('appending ${segment.type} SB, size:${segment.data.length}');
                  this.sourceBuffer[segment.type].appendBuffer(segment.data);
                  this.appendError = 0;
                } catch (err) {
                  // in case any error occured while appending, put back segment in mp4segments table
                  _utilsLogger.logger.error('error while trying to append buffer:' + err.message + ',try appending later');
                  this.mp4segments.unshift(segment);
                  if (this.appendError) {
                    this.appendError++;
                  } else {
                    this.appendError = 1;
                  }
                  var event = { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_APPENDING_ERROR, frag: this.frag };
                  /* with UHD content, we could get loop of quota exceeded error until
                    browser is able to evict some data from sourcebuffer. retrying help recovering this
                  */
                  if (this.appendError > this.config.appendErrorMaxRetry) {
                    _utilsLogger.logger.log('fail ' + this.config.appendErrorMaxRetry + ' times to append segment in sourceBuffer');
                    event.fatal = true;
                    _observer2['default'].trigger(_events2['default'].ERROR, event);
                    this.state = this.ERROR;
                    return;
                  } else {
                    event.fatal = false;
                    _observer2['default'].trigger(_events2['default'].ERROR, event);
                  }
                }
                this.state = this.APPENDING;
              }
          } else {
            // sourceBuffer undefined, switch back to IDLE state
            this.state = this.IDLE;
          }
          break;
        case this.BUFFER_FLUSHING:
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
            // move to IDLE once flush complete. this should trigger new fragment loading
            this.state = this.IDLE;
            // reset reference to frag
            this.frag = null;
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
    }
  }, {
    key: 'bufferInfo',
    value: function bufferInfo(pos) {
      var v = this.video,
          buffered = v.buffered,
          bufferLen,

      // bufferStart and bufferEnd are buffer boundaries around current video position
      bufferStart,
          bufferEnd,
          i;
      var buffered2 = [];
      // there might be some small holes between buffer time range
      // consider that holes smaller than 300 ms are irrelevant and build another
      // buffer time range representations that discards those holes
      for (i = 0; i < buffered.length; i++) {
        //logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
        if (buffered2.length && buffered.start(i) - buffered2[buffered2.length - 1].end < 0.3) {
          buffered2[buffered2.length - 1].end = buffered.end(i);
        } else {
          buffered2.push({ start: buffered.start(i), end: buffered.end(i) });
        }
      }
      for (i = 0, bufferLen = 0, bufferStart = bufferEnd = pos; i < buffered2.length; i++) {
        //logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
        if (pos + 0.3 >= buffered2[i].start && pos < buffered2[i].end) {
          // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
          bufferStart = buffered2[i].start;
          bufferEnd = buffered2[i].end + 0.3;
          bufferLen = bufferEnd - pos;
        }
      }
      return { len: bufferLen, start: bufferStart, end: bufferEnd };
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
      var v = this.video,
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
      var rangeCurrent, currentTime;
      if (this.video && this.video.seeking === false) {
        this.lastCurrentTime = currentTime = this.video.currentTime;
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
          if (rangeCurrent.frag !== this.fragCurrent) {
            this.fragCurrent = rangeCurrent.frag;
            _observer2['default'].trigger(_events2['default'].FRAG_CHANGED, { frag: this.fragCurrent });
          }
          // if stream is VOD (not live) and we reach End of Stream
          var level = this.levels[this.level];
          if (level && level.details && !level.details.live) {
            // are we playing last fragment ?
            if (rangeCurrent.frag.sn === level.details.endSN) {
              if (this.mediaSource && this.mediaSource.readyState === 'open') {
                _utilsLogger.logger.log('all media data available, signal endOfStream() to MediaSource');
                //Notify the media element that it now has all of the media data
                this.mediaSource.endOfStream();
              }
            }
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
      //logger.log('flushBuffer,pos/start/end: ' + this.video.currentTime + '/' + startOffset + '/' + endOffset);
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
                _utilsLogger.logger.log('flush ' + type + ' [' + flushStart + ',' + flushEnd + '], of [' + bufStart + ',' + bufEnd + '], pos:' + this.video.currentTime);
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
        this.previouslyPaused = this.video.paused;
        this.video.pause();
      }
      if (this.frag && this.frag.loader) {
        this.frag.loader.abort();
      }
      this.frag = null;
      // flush everything
      this.flushBufferCounter = 0;
      this.flushRange.push({ start: 0, end: Number.POSITIVE_INFINITY });
      // trigger a sourceBuffer flush
      this.state = this.BUFFER_FLUSHING;
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
      this.video.currentTime -= 0.0001;
      if (!this.previouslyPaused) {
        this.video.play();
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
      currentRange = this.getBufferRange(this.video.currentTime);
      if (currentRange) {
        // flush buffer preceding current fragment (flush until current fragment start offset)
        // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.flushRange.push({ start: 0, end: currentRange.start - 1 });
      }
      if (!this.video.paused) {
        // add a safety delay of 1s
        var nextLevelId = this.hls.nextLoadLevel,
            nextLevel = this.levels[nextLevelId];
        if (this.hls.stats.fragLastKbps && this.frag) {
          fetchdelay = this.frag.duration * nextLevel.bitrate / (1000 * this.hls.stats.fragLastKbps) + 1;
        } else {
          fetchdelay = 0;
        }
      } else {
        fetchdelay = 0;
      }
      //logger.log('fetchdelay:'+fetchdelay);
      // find buffer range that will be reached once new fragment will be fetched
      nextRange = this.getBufferRange(this.video.currentTime + fetchdelay);
      if (nextRange) {
        // we can flush buffer range following this one without stalling playback
        nextRange = this.followingBufferRange(nextRange);
        if (nextRange) {
          // flush position is the start position of this new buffer
          this.flushRange.push({ start: nextRange.start, end: Number.POSITIVE_INFINITY });
        }
      }
      if (this.flushRange.length) {
        this.flushBufferCounter = 0;
        // trigger a sourceBuffer flush
        this.state = this.BUFFER_FLUSHING;
        // increase fragment load Index to avoid frag loop loading error after buffer flush
        this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
        // speed up switching, trigger timer function
        this.tick();
      }
    }
  }, {
    key: 'onMSEAttached',
    value: function onMSEAttached(event, data) {
      this.video = data.video;
      this.mediaSource = data.mediaSource;
      this.onvseeking = this.onVideoSeeking.bind(this);
      this.onvseeked = this.onVideoSeeked.bind(this);
      this.onvmetadata = this.onVideoMetadata.bind(this);
      this.onvended = this.onVideoEnded.bind(this);
      this.video.addEventListener('seeking', this.onvseeking);
      this.video.addEventListener('seeked', this.onvseeked);
      this.video.addEventListener('loadedmetadata', this.onvmetadata);
      this.video.addEventListener('ended', this.onvended);
      if (this.levels && this.config.autoStartLoad) {
        this.startLoad();
      }
    }
  }, {
    key: 'onMSEDetached',
    value: function onMSEDetached() {
      this.video = null;
      this.loadedmetadata = false;
      this.stop();
    }
  }, {
    key: 'onVideoSeeking',
    value: function onVideoSeeking() {
      if (this.state === this.LOADING) {
        // check if currently loaded fragment is inside buffer.
        //if outside, cancel fragment loading, otherwise do nothing
        if (this.bufferInfo(this.video.currentTime).len === 0) {
          _utilsLogger.logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
          this.frag.loader.abort();
          this.frag = null;
          // switch to IDLE state to load new fragment
          this.state = this.IDLE;
        }
      }
      if (this.video) {
        this.lastCurrentTime = this.video.currentTime;
      }
      // avoid reporting fragment loop loading error in case user is seeking several times on same position
      if (this.fragLoadIdx !== undefined) {
        this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      }
      // tick to speed up processing
      this.tick();
    }
  }, {
    key: 'onVideoSeeked',
    value: function onVideoSeeked() {
      // tick to speed up FRAGMENT_PLAYING triggering
      this.tick();
    }
  }, {
    key: 'onVideoMetadata',
    value: function onVideoMetadata() {
      if (this.video.currentTime !== this.startPosition) {
        this.video.currentTime = this.startPosition;
      }
      this.loadedmetadata = true;
      this.tick();
    }
  }, {
    key: 'onVideoEnded',
    value: function onVideoEnded() {
      _utilsLogger.logger.log('video ended');
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
      if (this.video && this.config.autoStartLoad) {
        this.startLoad();
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(event, data) {
      var newLevelDetails = data.details,
          duration = newLevelDetails.totalduration,
          newLevelId = data.level,
          newLevel = this.levels[newLevelId],
          curLevel = this.levels[this.level],
          sliding = 0;
      _utilsLogger.logger.log('level ' + newLevelId + ' loaded [' + newLevelDetails.startSN + ',' + newLevelDetails.endSN + '],duration:' + duration);
      // check if playlist is already loaded (if yes, it should be a live playlist)
      if (curLevel && curLevel.details && curLevel.details.live) {
        var curLevelDetails = curLevel.details;
        //  playlist sliding is the sum of : current playlist sliding + sliding of new playlist compared to current one
        // check sliding of updated playlist against current one :
        // and find its position in current playlist
        //logger.log("fragments[0].sn/this.level/curLevel.details.fragments[0].sn:" + fragments[0].sn + "/" + this.level + "/" + curLevel.details.fragments[0].sn);
        var SNdiff = newLevelDetails.startSN - curLevelDetails.startSN;
        if (SNdiff >= 0) {
          // positive sliding : new playlist sliding window is after previous one
          var oldfragments = curLevelDetails.fragments;
          if (SNdiff < oldfragments.length) {
            sliding = curLevelDetails.sliding + oldfragments[SNdiff].start;
          } else {
            _utilsLogger.logger.log('cannot compute sliding, no SN in common between old/new level:[' + curLevelDetails.startSN + ',' + curLevelDetails.endSN + ']/[' + newLevelDetails.startSN + ',' + newLevelDetails.endSN + ']');
            sliding = undefined;
          }
        } else {
          // negative sliding: new playlist sliding window is before previous one
          sliding = curLevelDetails.sliding - newLevelDetails.fragments[-SNdiff].start;
        }
        if (sliding) {
          _utilsLogger.logger.log('live playlist sliding:' + sliding.toFixed(3));
        }
      }
      // override level info
      newLevel.details = newLevelDetails;
      newLevel.details.sliding = sliding;
      if (this.startLevelLoaded === false) {
        // if live playlist, set start position to be fragment N-3
        if (newLevelDetails.live) {
          this.startPosition = Math.max(0, duration - 3 * newLevelDetails.targetduration);
        }
        this.nextLoadPosition = this.startPosition;
        this.startLevelLoaded = true;
      }
      // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
      if (this.state === this.WAITING_LEVEL) {
        this.state = this.IDLE;
      }
      //trigger handler right now
      this.tick();
    }
  }, {
    key: 'onFragmentLoaded',
    value: function onFragmentLoaded(event, data) {
      if (this.state === this.LOADING) {
        if (this.fragmentBitrateTest === true) {
          // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
          this.state = this.IDLE;
          this.fragmentBitrateTest = false;
          data.stats.tparsed = data.stats.tbuffered = new Date();
          _observer2['default'].trigger(_events2['default'].FRAG_BUFFERED, { stats: data.stats, frag: this.frag });
          this.frag = null;
        } else {
          this.state = this.PARSING;
          // transmux the MPEG-TS data to ISO-BMFF segments
          this.stats = data.stats;
          var currentLevel = this.levels[this.level],
              details = currentLevel.details,
              duration = details.totalduration,
              start = this.frag.start;
          if (details.live) {
            duration += details.sliding;
            start += details.sliding;
          }
          if (this.frag.drift) {
            start += this.frag.drift;
          }
          _utilsLogger.logger.log('Demuxing ' + this.frag.sn + ' of [' + details.startSN + ' ,' + details.endSN + '],level ' + this.level);
          this.demuxer.push(data.payload, currentLevel.audioCodec, currentLevel.videoCodec, start, this.frag.cc, this.level, duration);
        }
      }
    }
  }, {
    key: 'onInitSegment',
    value: function onInitSegment(event, data) {
      if (this.state === this.PARSING) {
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
        if (this.audiocodecswitch && data.audioChannelCount === 2 && navigator.userAgent.toLowerCase().indexOf('android') === -1 && navigator.userAgent.toLowerCase().indexOf('firefox') === -1) {
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
    key: 'onFragmentParsing',
    value: function onFragmentParsing(event, data) {
      if (this.state === this.PARSING) {
        this.tparse2 = Date.now();
        var level = this.levels[this.level];
        if (level.details.live) {
          var fragments = this.levels[this.level].details.fragments;
          var sn0 = fragments[0].sn,
              sn1 = fragments[fragments.length - 1].sn,
              sn = this.frag.sn;
          //retrieve this.frag.sn in this.levels[this.level]
          if (sn >= sn0 && sn <= sn1) {
            level.details.sliding = data.startPTS - fragments[sn - sn0].start;
            //logger.log('live playlist sliding:${level.details.sliding.toFixed(3)}');
          }
        }
        _utilsLogger.logger.log('parsed data, type/startPTS/endPTS/startDTS/endDTS/nb:' + data.type + '/' + data.startPTS.toFixed(3) + '/' + data.endPTS.toFixed(3) + '/' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '/' + data.nb);
        //this.frag.drift=data.startPTS-this.frag.start;
        this.frag.drift = 0;
        // if(level.details.sliding) {
        //   this.frag.drift-=level.details.sliding;
        // }
        //logger.log('      drift:${this.frag.drift.toFixed(3)}');
        this.mp4segments.push({ type: data.type, data: data.moof });
        this.mp4segments.push({ type: data.type, data: data.mdat });
        this.nextLoadPosition = data.endPTS;
        this.bufferRange.push({ type: data.type, start: data.startPTS, end: data.endPTS, frag: this.frag });
        // if(data.type === 'video') {
        //   this.frag.fpsExpected = (data.nb-1) / (data.endPTS - data.startPTS);
        // }
        //trigger handler right now
        this.tick();
      } else {
        _utilsLogger.logger.warn('not in PARSING state, discarding ' + event);
      }
    }
  }, {
    key: 'onFragmentParsed',
    value: function onFragmentParsed() {
      if (this.state === this.PARSING) {
        this.state = this.PARSED;
        this.stats.tparsed = new Date();
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
          // if fatal error, stop processing, otherwise move to IDLE to retry loading
          _utilsLogger.logger.warn('buffer controller: ' + data.details + ' while loading frag,switch to ' + (data.fatal ? 'ERROR' : 'IDLE') + ' state ...');
          this.state = data.fatal ? this.ERROR : this.IDLE;
          this.frag = null;
          break;
        default:
          break;
      }
    }
  }, {
    key: 'onSourceBufferUpdateEnd',
    value: function onSourceBufferUpdateEnd() {
      //trigger handler right now
      if (this.state === this.APPENDING && this.mp4segments.length === 0) {
        if (this.frag) {
          this.stats.tbuffered = new Date();
          _observer2['default'].trigger(_events2['default'].FRAG_BUFFERED, { stats: this.stats, frag: this.frag });
          _utilsLogger.logger.log('video buffered : ' + this.timeRangesToString(this.video.buffered));
          this.state = this.IDLE;
        }
      }
      this.tick();
    }
  }, {
    key: 'onSourceBufferError',
    value: function onSourceBufferError(event) {
      _utilsLogger.logger.error('sourceBuffer error:' + event);
      this.state = this.ERROR;
      _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_APPENDING_ERROR, fatal: true, frag: this.frag });
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
      if (this.video) {
        var range = this.getBufferRange(this.video.currentTime);
        if (range) {
          return range.frag.level;
        }
      }
      return -1;
    }
  }, {
    key: 'nextBufferRange',
    get: function get() {
      if (this.video) {
        // first get end range of current fragment
        return this.followingBufferRange(this.getBufferRange(this.video.currentTime));
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

  return BufferController;
})();

exports['default'] = BufferController;
module.exports = exports['default'];

},{"../demux/demuxer":5,"../errors":9,"../events":10,"../observer":14,"../utils/logger":17}],4:[function(require,module,exports){
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

var _observer = require('../observer');

var _observer2 = _interopRequireDefault(_observer);

var _utilsLogger = require('../utils/logger');

var _errors = require('../errors');

var LevelController = (function () {
  function LevelController(hls) {
    _classCallCheck(this, LevelController);

    this.hls = hls;
    this.onml = this.onManifestLoaded.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onflp = this.onFragmentLoadProgress.bind(this);
    this.onerr = this.onError.bind(this);
    this.ontick = this.tick.bind(this);
    _observer2['default'].on(_events2['default'].MANIFEST_LOADED, this.onml);
    _observer2['default'].on(_events2['default'].FRAG_LOAD_PROGRESS, this.onflp);
    _observer2['default'].on(_events2['default'].LEVEL_LOADED, this.onll);
    _observer2['default'].on(_events2['default'].ERROR, this.onerr);
    this._manualLevel = this._autoLevelCapping = -1;
  }

  _createClass(LevelController, [{
    key: 'destroy',
    value: function destroy() {
      _observer2['default'].off(_events2['default'].MANIFEST_LOADED, this.onml);
      _observer2['default'].off(_events2['default'].FRAG_LOAD_PROGRESS, this.onflp);
      _observer2['default'].off(_events2['default'].LEVEL_LOADED, this.onll);
      _observer2['default'].off(_events2['default'].ERROR, this.onerr);
      if (this.timer) {
        clearInterval(this.timer);
      }
      this._manualLevel = -1;
    }
  }, {
    key: 'onManifestLoaded',
    value: function onManifestLoaded(event, data) {
      var levels = [],
          bitrateStart,
          i,
          bitrateSet = {};
      data.levels.forEach(function (level) {
        var redundantLevelId = bitrateSet[level.bitrate];
        if (redundantLevelId === undefined) {
          bitrateSet[level.bitrate] = levels.length;
          level.url = [level.url];
          level.urlId = 0;
          levels.push(level);
        } else {
          levels[redundantLevelId].url.push(level.url);
        }
      });
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
      _observer2['default'].trigger(_events2['default'].MANIFEST_PARSED, { levels: this._levels, firstLevel: this._firstLevel, stats: data.stats });
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
        _observer2['default'].trigger(_events2['default'].LEVEL_SWITCH, { level: newLevel });
        var level = this._levels[newLevel];
        // check if we need to load playlist for this level
        if (level.details === undefined || level.details.live === true) {
          // level not retrieved yet, or live playlist we need to (re)load it
          _utilsLogger.logger.log('(re)loading playlist for level ' + newLevel);
          var urlId = level.urlId;
          _observer2['default'].trigger(_events2['default'].LEVEL_LOADING, { url: level.url[urlId], level: newLevel, id: urlId });
        }
      } else {
        // invalid level id given, trigger error
        _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.OTHER_ERROR, details: _errors.ErrorDetails.LEVEL_SWITCH_ERROR, level: newLevel, fatal: false, reason: 'invalid level idx' });
      }
    }
  }, {
    key: 'onFragmentLoadProgress',
    value: function onFragmentLoadProgress(event, data) {
      var stats = data.stats;
      if (stats.aborted === undefined) {
        this.lastfetchduration = (new Date() - stats.trequest) / 1000;
        this.lastfetchlevel = data.frag.level;
        this.lastbw = stats.loaded * 8 / this.lastfetchduration;
        //console.log('fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}/${stats.aborted}');
      }
    }
  }, {
    key: 'onError',
    value: function onError(event, data) {
      var details = data.details,
          levelId,
          level;
      // try to recover not fatal errors
      switch (details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
        case _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
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
            this.lastbw = 0;
            this.lastfetchduration = 0;
          } else {
            _utilsLogger.logger.error('cannot recover ' + details + ' error');
            this._level = undefined;
            // stopping live reloading timer if any
            if (this.timer) {
              clearInterval(this.timer);
              this.timer = null;
              // redispatch same error but with fatal set to true
              data.fatal = true;
              _observer2['default'].trigger(event, data);
            }
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
    }
  }, {
    key: 'tick',
    value: function tick() {
      var levelId = this._level;
      if (levelId !== undefined) {
        var level = this._levels[levelId],
            urlId = level.urlId;
        _observer2['default'].trigger(_events2['default'].LEVEL_LOADING, { url: level.url[urlId], level: levelId, id: urlId });
      }
    }
  }, {
    key: 'nextLoadLevel',
    value: function nextLoadLevel() {
      if (this._manualLevel !== -1) {
        return this._manualLevel;
      } else {
        return this.nextAutoLevel();
      }
    }
  }, {
    key: 'nextAutoLevel',
    value: function nextAutoLevel() {
      var lastbw = this.lastbw,
          adjustedbw,
          i,
          maxAutoLevel;
      if (this._autoLevelCapping === -1) {
        maxAutoLevel = this._levels.length - 1;
      } else {
        maxAutoLevel = this._autoLevelCapping;
      }
      // follow algorithm captured from stagefright :
      // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
      // Pick the highest bandwidth stream below or equal to estimated bandwidth.
      for (i = 0; i <= maxAutoLevel; i++) {
        // consider only 80% of the available bandwidth, but if we are switching up,
        // be even more conservative (70%) to avoid overestimating and immediately
        // switching back.
        if (i <= this._level) {
          adjustedbw = 0.8 * lastbw;
        } else {
          adjustedbw = 0.7 * lastbw;
        }
        if (adjustedbw < this._levels[i].bitrate) {
          return Math.max(0, i - 1);
        }
      }
      return i - 1;
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

},{"../errors":9,"../events":10,"../observer":14,"../utils/logger":17}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _tsdemuxer = require('./tsdemuxer');

var _tsdemuxer2 = _interopRequireDefault(_tsdemuxer);

var _tsdemuxerworker = require('./tsdemuxerworker');

var _tsdemuxerworker2 = _interopRequireDefault(_tsdemuxerworker);

var _observer = require('../observer');

var _observer2 = _interopRequireDefault(_observer);

var _utilsLogger = require('../utils/logger');

var Demuxer = (function () {
  function Demuxer(config) {
    _classCallCheck(this, Demuxer);

    if (config.enableWorker && typeof Worker !== 'undefined') {
      _utilsLogger.logger.log('TS demuxing in webworker');
      try {
        var work = require('webworkify');
        this.w = work(_tsdemuxerworker2['default']);
        this.onwmsg = this.onWorkerMessage.bind(this);
        this.w.addEventListener('message', this.onwmsg);
        this.w.postMessage({ cmd: 'init' });
      } catch (err) {
        _utilsLogger.logger.error('error while initializing TSDemuxerWorker, fallback on regular TSDemuxer');
        this.demuxer = new _tsdemuxer2['default']();
      }
    } else {
      this.demuxer = new _tsdemuxer2['default']();
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
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, duration) {
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: cc, level: level, duration: duration }, [data]);
      } else {
        this.demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset, cc, level, duration);
        this.demuxer.end();
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
          _observer2['default'].trigger(_events2['default'].FRAG_PARSING_INIT_SEGMENT, obj);
          break;
        case _events2['default'].FRAG_PARSING_DATA:
          _observer2['default'].trigger(_events2['default'].FRAG_PARSING_DATA, {
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
        default:
          _observer2['default'].trigger(ev.data.event, ev.data.data);
          break;
      }
    }
  }]);

  return Demuxer;
})();

exports['default'] = Demuxer;
module.exports = exports['default'];

},{"../events":10,"../observer":14,"../utils/logger":17,"./tsdemuxer":7,"./tsdemuxerworker":8,"webworkify":2}],6:[function(require,module,exports){
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
        profileIdc: profileIdc,
        profileCompat: profileCompat,
        levelIdc: levelIdc,
        width: (picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2,
        height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - frameCropTopOffset * 2 - frameCropBottomOffset * 2
      };
    }
  }]);

  return ExpGolomb;
})();

exports['default'] = ExpGolomb;
module.exports = exports['default'];

},{"../utils/logger":17}],7:[function(require,module,exports){
/**
 * A stream-based mp2ts to mp4 converter. This utility is used to
 * deliver mp4s to a SourceBuffer on platforms that support native
 * Media Source Extensions.
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

var _remuxMp4Generator = require('../remux/mp4-generator');

var _remuxMp4Generator2 = _interopRequireDefault(_remuxMp4Generator);

var _observer = require('../observer');

var _observer2 = _interopRequireDefault(_observer);

var _utilsLogger = require('../utils/logger');

var _errors = require('../errors');

var TSDemuxer = (function () {
  function TSDemuxer() {
    _classCallCheck(this, TSDemuxer);

    this.lastCC = 0;
    this.PES_TIMESCALE = 90000;
    this.PES2MP4SCALEFACTOR = 4;
    this.MP4_TIMESCALE = this.PES_TIMESCALE / this.PES2MP4SCALEFACTOR;
  }

  _createClass(TSDemuxer, [{
    key: 'switchLevel',
    value: function switchLevel() {
      this.pmtParsed = false;
      this._pmtId = this._avcId = this._aacId = -1;
      this._avcTrack = { type: 'video', sequenceNumber: 0 };
      this._aacTrack = { type: 'audio', sequenceNumber: 0 };
      this._avcSamples = [];
      this._avcSamplesLength = 0;
      this._avcSamplesNbNalu = 0;
      this._aacSamples = [];
      this._aacSamplesLength = 0;
      this._initSegGenerated = false;
    }
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {
      this.switchLevel();
      this._initPTS = this._initDTS = undefined;
    }

    // feed incoming data to the front of the parsing pipeline
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, duration) {
      var avcData,
          aacData,
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
      if (cc !== this.lastCC) {
        _utilsLogger.logger.log('discontinuity detected');
        this.insertDiscontinuity();
        this.lastCC = cc;
      } else if (level !== this.lastLevel) {
        _utilsLogger.logger.log('level switch detected');
        this.switchLevel();
        this.lastLevel = level;
      }
      var pmtParsed = this.pmtParsed,
          avcId = this._avcId,
          aacId = this._aacId;
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
              avcId = this._avcId;
              aacId = this._aacId;
            }
          }
        } else {
          _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'TS packet did not start with 0x47' });
        }
      }
      // parse last PES packet
      if (avcData) {
        this._parseAVCPES(this._parsePES(avcData));
      }
      if (aacData) {
        this._parseAACPES(this._parsePES(aacData));
      }
    }
  }, {
    key: 'end',
    value: function end() {
      // generate Init Segment if needed
      if (!this._initSegGenerated) {
        this._generateInitSegment();
      }
      //logger.log('nb AVC samples:' + this._avcSamples.length);
      if (this._avcSamples.length) {
        this._flushAVCSamples();
      }
      //logger.log('nb AAC samples:' + this._aacSamples.length);
      if (this._aacSamples.length) {
        this._flushAACSamples();
      }
      //notify end of parsing
      _observer2['default'].trigger(_events2['default'].FRAG_PARSED);
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
            this._aacId = pid;
            this._aacTrack.id = pid;
            break;
          // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
          case 0x1b:
            //logger.log('AVC PID:'  + pid);
            this._avcId = pid;
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

      var units,
          track = this._avcTrack,
          avcSample,
          key = false;
      units = this._parseAVCNALu(pes.data);
      // no NALu found
      if (units.length === 0 & this._avcSamples.length > 0) {
        // append pes.data to previous NAL unit
        var lastavcSample = this._avcSamples[this._avcSamples.length - 1];
        var lastUnit = lastavcSample.units.units[lastavcSample.units.units.length - 1];
        var tmp = new Uint8Array(lastUnit.data.byteLength + pes.data.byteLength);
        tmp.set(lastUnit.data, 0);
        tmp.set(pes.data, lastUnit.data.byteLength);
        lastUnit.data = tmp;
        lastavcSample.units.length += pes.data.byteLength;
        this._avcSamplesLength += pes.data.byteLength;
      }
      //free pes.data to save up some memory
      pes.data = null;
      units.units.forEach(function (unit) {
        switch (unit.type) {
          //IDR
          case 5:
            key = true;
            break;
          //SPS
          case 7:
            if (!track.sps) {
              var expGolombDecoder = new _expGolomb2['default'](unit.data);
              var config = expGolombDecoder.readSPS();
              track.width = config.width;
              track.height = config.height;
              track.profileIdc = config.profileIdc;
              track.profileCompat = config.profileCompat;
              track.levelIdc = config.levelIdc;
              track.sps = [unit.data];
              track.timescale = _this.MP4_TIMESCALE;
              track.duration = _this.MP4_TIMESCALE * _this._duration;
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
            if (!track.pps) {
              track.pps = [unit.data];
            }
            break;
          default:
            break;
        }
      });
      //build sample from PES
      // Annex B to MP4 conversion to be done
      if (units.length) {
        avcSample = { units: units, pts: pes.pts, dts: pes.dts, key: key };
        this._avcSamples.push(avcSample);
        this._avcSamplesLength += units.length;
        this._avcSamplesNbNalu += units.units.length;
      }
    }
  }, {
    key: '_flushAVCSamples',
    value: function _flushAVCSamples() {
      var view,
          i = 8,
          avcSample,
          mp4Sample,
          mp4SampleLength,
          unit,
          track = this._avcTrack,
          lastSampleDTS,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          pts,
          dts,
          ptsnorm,
          dtsnorm,
          samples = [];
      /* concatenate the video data and construct the mdat in place
        (need 8 more bytes to fill length and mpdat type) */
      mdat = new Uint8Array(this._avcSamplesLength + 4 * this._avcSamplesNbNalu + 8);
      view = new DataView(mdat.buffer);
      view.setUint32(0, mdat.byteLength);
      mdat.set(_remuxMp4Generator2['default'].types.mdat, 4);
      while (this._avcSamples.length) {
        avcSample = this._avcSamples.shift();
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
        //logger.log('Video/PTS/DTS:' + avcSample.pts + '/' + avcSample.dts);
        if (lastSampleDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastSampleDTS);
          dtsnorm = this._PTSNormalize(dts, lastSampleDTS);
          mp4Sample.duration = (dtsnorm - lastSampleDTS) / this.PES2MP4SCALEFACTOR;
          if (mp4Sample.duration < 0) {
            //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
            mp4Sample.duration = 0;
          }
        } else {
          ptsnorm = this._PTSNormalize(pts, this.nextAvcPts);
          dtsnorm = this._PTSNormalize(dts, this.nextAvcPts);
          // check if fragments are contiguous (i.e. no missing frames between fragment)
          if (this.nextAvcPts) {
            var delta = Math.round((ptsnorm - this.nextAvcPts) / 90),
                absdelta = Math.abs(delta);
            //logger.log('absdelta/avcSample.pts:' + absdelta + '/' + avcSample.pts);
            // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
            if (absdelta < 300) {
              //logger.log('Video next PTS:' + this.nextAvcPts);
              if (delta > 1) {
                _utilsLogger.logger.log('AVC:' + delta + ' ms hole between fragments detected,filling it');
              } else if (delta < -1) {
                _utilsLogger.logger.log('AVC:' + -delta + ' ms overlapping between fragments detected');
              }
              // set PTS to next PTS
              ptsnorm = this.nextAvcPts;
              // offset DTS as well, ensure that DTS is smaller or equal than new PTS
              dtsnorm = Math.max(dtsnorm - delta, this.lastAvcDts);
              // logger.log('Video/PTS/DTS adjusted:' + avcSample.pts + '/' + avcSample.dts);
            } else {
                // not contiguous timestamp, check if PTS is within acceptable range
                var expectedPTS = this.PES_TIMESCALE * this.timeOffset;
                // check if there is any unexpected drift between expected timestamp and real one
                if (Math.abs(expectedPTS - ptsnorm) > this.PES_TIMESCALE * 3600) {
                  //logger.log('PTS looping ??? AVC PTS delta:${expectedPTS-ptsnorm}');
                  var ptsOffset = expectedPTS - ptsnorm;
                  // set PTS to next expected PTS;
                  ptsnorm = expectedPTS;
                  dtsnorm = ptsnorm;
                  // offset initPTS/initDTS to fix computation for following samples
                  this._initPTS -= ptsOffset;
                  this._initDTS -= ptsOffset;
                }
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
          cts: (ptsnorm - dtsnorm) / this.PES2MP4SCALEFACTOR,
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
        lastSampleDTS = dtsnorm;
      }
      if (samples.length >= 2) {
        mp4Sample.duration = samples[samples.length - 2].duration;
      }
      this.lastAvcDts = dtsnorm;
      // next AVC sample PTS should be equal to last sample PTS + duration
      this.nextAvcPts = ptsnorm + mp4Sample.duration * this.PES2MP4SCALEFACTOR;
      //logger.log('Video/lastAvcDts/nextAvcPts:' + this.lastAvcDts + '/' + this.nextAvcPts);
      this._avcSamplesLength = 0;
      this._avcSamplesNbNalu = 0;
      track.samples = samples;
      moof = _remuxMp4Generator2['default'].moof(track.sequenceNumber++, firstDTS / this.PES2MP4SCALEFACTOR, track);
      track.samples = [];
      _observer2['default'].trigger(_events2['default'].FRAG_PARSING_DATA, {
        moof: moof,
        mdat: mdat,
        startPTS: firstPTS / this.PES_TIMESCALE,
        endPTS: this.nextAvcPts / this.PES_TIMESCALE,
        startDTS: firstDTS / this.PES_TIMESCALE,
        endDTS: (dtsnorm + this.PES2MP4SCALEFACTOR * mp4Sample.duration) / this.PES_TIMESCALE,
        type: 'video',
        nb: samples.length
      });
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
          lastUnitType,
          length = 0;
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
                length += i - state - 1 - lastUnitStart;
                //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
                units.push(unit);
              } else {
                // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
                overflow = i - state - 1;
                if (overflow) {
                  //logger.log('first NALU found with overflow:' + overflow);
                  if (this._avcSamples.length) {
                    var lastavcSample = this._avcSamples[this._avcSamples.length - 1];
                    var lastUnit = lastavcSample.units.units[lastavcSample.units.units.length - 1];
                    var tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                    tmp.set(lastUnit.data, 0);
                    tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                    lastUnit.data = tmp;
                    lastavcSample.units.length += overflow;
                    this._avcSamplesLength += overflow;
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
        length += len - lastUnitStart;
        units.push(unit);
        //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
      }
      return { units: units, length: length };
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
        _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: fatal, reason: reason });
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
        track.timescale = this.MP4_TIMESCALE;
        track.duration = this.MP4_TIMESCALE * this._duration;
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
        if (adtsStartOffset + adtsHeaderLen + adtsFrameSize <= len) {
          aacSample = { unit: data.subarray(adtsStartOffset + adtsHeaderLen, adtsStartOffset + adtsHeaderLen + adtsFrameSize), pts: stamp, dts: stamp };
          this._aacSamples.push(aacSample);
          this._aacSamplesLength += adtsFrameSize;
          adtsStartOffset += adtsFrameSize + adtsHeaderLen;
          nbSamples++;
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
    key: '_flushAACSamples',
    value: function _flushAACSamples() {
      var view,
          i = 8,
          aacSample,
          mp4Sample,
          unit,
          track = this._aacTrack,
          lastSampleDTS,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          pts,
          dts,
          ptsnorm,
          dtsnorm,
          samples = [];
      /* concatenate the audio data and construct the mdat in place
        (need 8 more bytes to fill length and mpdat type) */
      mdat = new Uint8Array(this._aacSamplesLength + 8);
      view = new DataView(mdat.buffer);
      view.setUint32(0, mdat.byteLength);
      mdat.set(_remuxMp4Generator2['default'].types.mdat, 4);
      while (this._aacSamples.length) {
        aacSample = this._aacSamples.shift();
        unit = aacSample.unit;
        mdat.set(unit, i);
        i += unit.byteLength;
        pts = aacSample.pts - this._initDTS;
        dts = aacSample.dts - this._initDTS;
        //logger.log('Audio/PTS:' + aacSample.pts.toFixed(0));
        if (lastSampleDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastSampleDTS);
          dtsnorm = this._PTSNormalize(dts, lastSampleDTS);
          // we use DTS to compute sample duration, but we use PTS to compute initPTS which is used to sync audio and video
          mp4Sample.duration = (dtsnorm - lastSampleDTS) / this.PES2MP4SCALEFACTOR;
          if (mp4Sample.duration < 0) {
            //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
            mp4Sample.duration = 0;
          }
        } else {
          ptsnorm = this._PTSNormalize(pts, this.nextAacPts);
          dtsnorm = this._PTSNormalize(dts, this.nextAacPts);
          // check if fragments are contiguous (i.e. no missing frames between fragment)
          if (this.nextAacPts && this.nextAacPts !== ptsnorm) {
            //logger.log('Audio next PTS:' + this.nextAacPts);
            var delta = Math.round(1000 * (ptsnorm - this.nextAacPts) / this.PES_TIMESCALE),
                absdelta = Math.abs(delta);
            // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
            if (absdelta > 1 && absdelta < 300) {
              if (delta > 0) {
                _utilsLogger.logger.log('AAC:' + delta + ' ms hole between fragments detected,filling it');
                // set PTS to next PTS, and ensure PTS is greater or equal than last DTS
                ptsnorm = Math.max(this.nextAacPts, this.lastAacDts);
                dtsnorm = ptsnorm;
                //logger.log('Audio/PTS/DTS adjusted:' + aacSample.pts + '/' + aacSample.dts);
              } else {
                  _utilsLogger.logger.log('AAC:' + -delta + ' ms overlapping between fragments detected');
                }
            } else if (absdelta) {
              // not contiguous timestamp, check if PTS is within acceptable range
              var expectedPTS = this.PES_TIMESCALE * this.timeOffset;
              //logger.log('expectedPTS/PTSnorm:${expectedPTS}/${ptsnorm}/${expectedPTS-ptsnorm}');
              // check if there is any unexpected drift between expected timestamp and real one
              if (Math.abs(expectedPTS - ptsnorm) > this.PES_TIMESCALE * 3600) {
                //logger.log('PTS looping ??? AAC PTS delta:${expectedPTS-ptsnorm}');
                var ptsOffset = expectedPTS - ptsnorm;
                // set PTS to next expected PTS;
                ptsnorm = expectedPTS;
                dtsnorm = ptsnorm;
                // offset initPTS/initDTS to fix computation for following samples
                this._initPTS -= ptsOffset;
                this._initDTS -= ptsOffset;
              }
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
        lastSampleDTS = dtsnorm;
      }
      //set last sample duration as being identical to previous sample
      if (samples.length >= 2) {
        mp4Sample.duration = samples[samples.length - 2].duration;
      }
      this.lastAacDts = dtsnorm;
      // next aac sample PTS should be equal to last sample PTS + duration
      this.nextAacPts = ptsnorm + this.PES2MP4SCALEFACTOR * mp4Sample.duration;
      //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
      this._aacSamplesLength = 0;
      track.samples = samples;
      moof = _remuxMp4Generator2['default'].moof(track.sequenceNumber++, firstDTS / this.PES2MP4SCALEFACTOR, track);
      track.samples = [];
      _observer2['default'].trigger(_events2['default'].FRAG_PARSING_DATA, {
        moof: moof,
        mdat: mdat,
        startPTS: firstPTS / this.PES_TIMESCALE,
        endPTS: this.nextAacPts / this.PES_TIMESCALE,
        startDTS: firstDTS / this.PES_TIMESCALE,
        endDTS: (dtsnorm + this.PES2MP4SCALEFACTOR * mp4Sample.duration) / this.PES_TIMESCALE,
        type: 'audio',
        nb: samples.length
      });
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
          adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000];
      // byte 2
      adtsObjectType = ((data[offset + 2] & 0xC0) >>> 6) + 1;
      adtsSampleingIndex = (data[offset + 2] & 0x3C) >>> 2;
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
          // if (manifest codec is HE-AAC) OR (manifest codec not specified AND frequency less than 24kHz)
          if (audioCodec && audioCodec.indexOf('mp4a.40.5') !== -1 || !audioCodec && adtsSampleingIndex >= 6) {
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
    key: '_generateInitSegment',
    value: function _generateInitSegment() {
      if (this._avcId === -1) {
        //audio only
        if (this._aacTrack.config) {
          _observer2['default'].trigger(_events2['default'].FRAG_PARSING_INIT_SEGMENT, {
            audioMoov: _remuxMp4Generator2['default'].initSegment([this._aacTrack]),
            audioCodec: this._aacTrack.codec,
            audioChannelCount: this._aacTrack.channelCount
          });
          this._initSegGenerated = true;
        }
        if (this._initPTS === undefined) {
          // remember first PTS of this demuxing context
          this._initPTS = this._aacSamples[0].pts - this.PES_TIMESCALE * this.timeOffset;
          this._initDTS = this._aacSamples[0].dts - this.PES_TIMESCALE * this.timeOffset;
        }
      } else if (this._aacId === -1) {
        //video only
        if (this._avcTrack.sps && this._avcTrack.pps) {
          _observer2['default'].trigger(_events2['default'].FRAG_PARSING_INIT_SEGMENT, {
            videoMoov: _remuxMp4Generator2['default'].initSegment([this._avcTrack]),
            videoCodec: this._avcTrack.codec,
            videoWidth: this._avcTrack.width,
            videoHeight: this._avcTrack.height
          });
          this._initSegGenerated = true;
          if (this._initPTS === undefined) {
            // remember first PTS of this demuxing context
            this._initPTS = this._avcSamples[0].pts - this.PES_TIMESCALE * this.timeOffset;
            this._initDTS = this._avcSamples[0].dts - this.PES_TIMESCALE * this.timeOffset;
          }
        }
      } else {
        //audio and video
        if (this._aacTrack.config && this._avcTrack.sps && this._avcTrack.pps) {
          _observer2['default'].trigger(_events2['default'].FRAG_PARSING_INIT_SEGMENT, {
            audioMoov: _remuxMp4Generator2['default'].initSegment([this._aacTrack]),
            audioCodec: this._aacTrack.codec,
            audioChannelCount: this._aacTrack.channelCount,
            videoMoov: _remuxMp4Generator2['default'].initSegment([this._avcTrack]),
            videoCodec: this._avcTrack.codec,
            videoWidth: this._avcTrack.width,
            videoHeight: this._avcTrack.height
          });
          this._initSegGenerated = true;
          if (this._initPTS === undefined) {
            // remember first PTS of this demuxing context
            this._initPTS = Math.min(this._avcSamples[0].pts, this._aacSamples[0].pts) - this.PES_TIMESCALE * this.timeOffset;
            this._initDTS = Math.min(this._avcSamples[0].dts, this._aacSamples[0].dts) - this.PES_TIMESCALE * this.timeOffset;
          }
        }
      }
    }
  }]);

  return TSDemuxer;
})();

exports['default'] = TSDemuxer;
module.exports = exports['default'];

},{"../errors":9,"../events":10,"../observer":14,"../remux/mp4-generator":15,"../utils/logger":17,"./exp-golomb":6}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _demuxTsdemuxer = require('../demux/tsdemuxer');

var _demuxTsdemuxer2 = _interopRequireDefault(_demuxTsdemuxer);

var _observer = require('../observer');

var _observer2 = _interopRequireDefault(_observer);

var TSDemuxerWorker = function TSDemuxerWorker(self) {
  self.addEventListener('message', function (ev) {
    //console.log('demuxer cmd:' + ev.data.cmd);
    switch (ev.data.cmd) {
      case 'init':
        self.demuxer = new _demuxTsdemuxer2['default']();
        break;
      case 'demux':
        self.demuxer.push(new Uint8Array(ev.data.data), ev.data.audioCodec, ev.data.videoCodec, ev.data.timeOffset, ev.data.cc, ev.data.level, ev.data.duration);
        self.demuxer.end();
        break;
      default:
        break;
    }
  });

  // listen to events triggered by TS Demuxer
  _observer2['default'].on(_events2['default'].FRAG_PARSING_INIT_SEGMENT, function (ev, data) {
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

  _observer2['default'].on(_events2['default'].FRAG_PARSING_DATA, function (ev, data) {
    var objData = { event: ev, type: data.type, startPTS: data.startPTS, endPTS: data.endPTS, startDTS: data.startDTS, endDTS: data.endDTS, moof: data.moof.buffer, mdat: data.mdat.buffer, nb: data.nb };
    // pass moof/mdat data as transferable object (no copy)
    self.postMessage(objData, [objData.moof, objData.mdat]);
  });

  _observer2['default'].on(_events2['default'].FRAG_PARSED, function (event) {
    self.postMessage({ event: event });
  });

  _observer2['default'].on(_events2['default'].ERROR, function (event, data) {
    self.postMessage({ event: event, data: data });
  });
};

exports['default'] = TSDemuxerWorker;
module.exports = exports['default'];

},{"../demux/tsdemuxer":7,"../events":10,"../observer":14}],9:[function(require,module,exports){
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
  // Identifier for a fragment parsing error event - data: parsing error description
  FRAG_PARSING_ERROR: 'fragParsingError',
  // Identifier for a fragment appending error event - data: appending error description
  FRAG_APPENDING_ERROR: 'fragAppendingError'
};
exports.ErrorDetails = ErrorDetails;

},{}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = {
  // fired when MediaSource has been succesfully attached to video element - data: { mediaSource }
  MSE_ATTACHED: 'hlsMediaSourceAttached',
  // fired when MediaSource has been detached from video element - data: { }
  MSE_DETACHED: 'hlsMediaSourceDetached',
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
  // fired when moof/mdat have been extracted from fragment - data: { moof : moof MP4 box, mdat : mdat MP4 box}
  FRAG_PARSING_DATA: 'hlsFragParsingData',
  // fired when fragment parsing is completed - data: undefined
  FRAG_PARSED: 'hlsFragParsed',
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED: 'hlsFragBuffered',
  // fired when fragment matching with current video position is changing - data : { frag : fragment object }
  FRAG_CHANGED: 'hlsFragChanged',
  // Identifier for a FPS drop event - data: {curentDropped, currentDecoded, totalDroppedFrames}
  FPS_DROP: 'hlsFPSDrop',
  // Identifier for an error event - data: { type : error type, details : error details, fatal : if true, hls.js cannot/will not try to recover, if false, hls.js will try to recover,other error specific data}
  ERROR: 'hlsError'
};
module.exports = exports['default'];

},{}],11:[function(require,module,exports){
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

var _stats = require('./stats');

var _stats2 = _interopRequireDefault(_stats);

var _observer = require('./observer');

var _observer2 = _interopRequireDefault(_observer);

var _loaderPlaylistLoader = require('./loader/playlist-loader');

var _loaderPlaylistLoader2 = _interopRequireDefault(_loaderPlaylistLoader);

var _loaderFragmentLoader = require('./loader/fragment-loader');

var _loaderFragmentLoader2 = _interopRequireDefault(_loaderFragmentLoader);

var _controllerBufferController = require('./controller/buffer-controller');

var _controllerBufferController2 = _interopRequireDefault(_controllerBufferController);

var _controllerLevelController = require('./controller/level-controller');

var _controllerLevelController2 = _interopRequireDefault(_controllerLevelController);

//import FPSController from './controller/fps-controller';

var _utilsLogger = require('./utils/logger');

var _utilsXhrLoader = require('./utils/xhr-loader');

var _utilsXhrLoader2 = _interopRequireDefault(_utilsXhrLoader);

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
      maxMaxBufferLength: 600,
      enableWorker: true,
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
      loader: _utilsXhrLoader2['default']
    };
    for (var prop in configDefault) {
      if (prop in config) {
        continue;
      }
      config[prop] = configDefault[prop];
    }
    (0, _utilsLogger.enableLogs)(config.debug);
    this.config = config;
    this.playlistLoader = new _loaderPlaylistLoader2['default'](this);
    this.fragmentLoader = new _loaderFragmentLoader2['default'](this);
    this.levelController = new _controllerLevelController2['default'](this);
    this.bufferController = new _controllerBufferController2['default'](this);
    //this.fpsController = new FPSController(this);
    this.statsHandler = new _stats2['default'](this);
    // observer setup
    this.on = _observer2['default'].on.bind(_observer2['default']);
    this.off = _observer2['default'].off.bind(_observer2['default']);
  }

  _createClass(Hls, [{
    key: 'destroy',
    value: function destroy() {
      _utilsLogger.logger.log('destroy');
      this.playlistLoader.destroy();
      this.fragmentLoader.destroy();
      this.levelController.destroy();
      this.bufferController.destroy();
      //this.fpsController.destroy();
      this.statsHandler.destroy();
      this.url = null;
      this.detachVideo();
      _observer2['default'].removeAllListeners();
    }
  }, {
    key: 'attachVideo',
    value: function attachVideo(video) {
      _utilsLogger.logger.log('attachVideo');
      this.video = video;
      this.statsHandler.attachVideo(video);
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
      video.src = URL.createObjectURL(ms);
      video.addEventListener('error', this.onverror);
    }
  }, {
    key: 'detachVideo',
    value: function detachVideo() {
      _utilsLogger.logger.log('detachVideo');
      var video = this.video;
      this.statsHandler.detachVideo(video);
      var ms = this.mediaSource;
      if (ms) {
        if (ms.readyState !== 'ended') {
          ms.endOfStream();
        }
        ms.removeEventListener('sourceopen', this.onmso);
        ms.removeEventListener('sourceended', this.onmse);
        ms.removeEventListener('sourceclose', this.onmsc);
        // unlink MediaSource from video tag
        video.src = '';
        this.mediaSource = null;
        _utilsLogger.logger.log('trigger MSE_DETACHED');
        _observer2['default'].trigger(_events2['default'].MSE_DETACHED);
      }
      this.onmso = this.onmse = this.onmsc = null;
      if (video) {
        this.video = null;
      }
    }
  }, {
    key: 'loadSource',
    value: function loadSource(url) {
      _utilsLogger.logger.log('loadSource:' + url);
      this.url = url;
      // when attaching to a source URL, trigger a playlist load
      _observer2['default'].trigger(_events2['default'].MANIFEST_LOADING, { url: url });
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      _utilsLogger.logger.log('startLoad');
      this.bufferController.startLoad();
    }
  }, {
    key: 'recoverMediaError',
    value: function recoverMediaError() {
      _utilsLogger.logger.log('recoverMediaError');
      var video = this.video;
      this.detachVideo();
      this.attachVideo(video);
    }

    /** Return all quality levels **/
  }, {
    key: 'onMediaSourceOpen',
    value: function onMediaSourceOpen() {
      _utilsLogger.logger.log('media source opened');
      _observer2['default'].trigger(_events2['default'].MSE_ATTACHED, { video: this.video, mediaSource: this.mediaSource });
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
    key: 'levels',
    get: function get() {
      return this.levelController.levels;
    }

    /** Return current playback quality level **/
  }, {
    key: 'currentLevel',
    get: function get() {
      return this.bufferController.currentLevel;
    },

    /* set quality level immediately (-1 for automatic level selection) */
    set: function set(newLevel) {
      _utilsLogger.logger.log('set currentLevel:' + newLevel);
      this.loadLevel = newLevel;
      this.bufferController.immediateLevelSwitch();
    }

    /** Return next playback quality level (quality level of next fragment) **/
  }, {
    key: 'nextLevel',
    get: function get() {
      return this.bufferController.nextLevel;
    },

    /* set quality level for next fragment (-1 for automatic level selection) */
    set: function set(newLevel) {
      _utilsLogger.logger.log('set nextLevel:' + newLevel);
      this.levelController.manualLevel = newLevel;
      this.bufferController.nextLevelSwitch();
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
      return this.levelController.autoLevelCapping;
    },

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    set: function set(newLevel) {
      _utilsLogger.logger.log('set autoLevelCapping:' + newLevel);
      this.levelController.autoLevelCapping = newLevel;
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

    /* return playback session stats */
  }, {
    key: 'stats',
    get: function get() {
      return this.statsHandler.stats;
    }
  }]);

  return Hls;
})();

exports['default'] = Hls;
module.exports = exports['default'];

},{"./controller/buffer-controller":3,"./controller/level-controller":4,"./errors":9,"./events":10,"./loader/fragment-loader":12,"./loader/playlist-loader":13,"./observer":14,"./stats":16,"./utils/logger":17,"./utils/xhr-loader":18}],12:[function(require,module,exports){
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

var _observer = require('../observer');

var _observer2 = _interopRequireDefault(_observer);

var _errors = require('../errors');

var FragmentLoader = (function () {
  function FragmentLoader(hls) {
    _classCallCheck(this, FragmentLoader);

    this.hls = hls;
    this.onfl = this.onFragLoading.bind(this);
    _observer2['default'].on(_events2['default'].FRAG_LOADING, this.onfl);
  }

  _createClass(FragmentLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      _observer2['default'].off(_events2['default'].FRAG_LOADING, this.onfl);
    }
  }, {
    key: 'onFragLoading',
    value: function onFragLoading(event, data) {
      var frag = data.frag;
      this.frag = frag;
      this.frag.loaded = 0;
      var config = this.hls.config;
      frag.loader = this.loader = new config.loader(config);
      this.loader.load(frag.url, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, config.fragLoadingMaxRetry, config.fragLoadingRetryDelay, this.loadprogress.bind(this));
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var payload = event.currentTarget.response;
      stats.length = payload.byteLength;
      // detach fragment loader on load success
      this.frag.loader = undefined;
      _observer2['default'].trigger(_events2['default'].FRAG_LOADED, { payload: payload, frag: this.frag, stats: stats });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      this.loader.abort();
      _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: this.frag, response: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      this.loader.abort();
      _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: this.frag });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event, stats) {
      this.frag.loaded = stats.loaded;
      _observer2['default'].trigger(_events2['default'].FRAG_LOAD_PROGRESS, { frag: this.frag, stats: stats });
    }
  }]);

  return FragmentLoader;
})();

exports['default'] = FragmentLoader;
module.exports = exports['default'];

},{"../errors":9,"../events":10,"../observer":14}],13:[function(require,module,exports){
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

var _observer = require('../observer');

var _observer2 = _interopRequireDefault(_observer);

var _errors = require('../errors');

//import {logger} from '../utils/logger';

var PlaylistLoader = (function () {
  function PlaylistLoader(hls) {
    _classCallCheck(this, PlaylistLoader);

    this.hls = hls;
    this.onml = this.onManifestLoading.bind(this);
    this.onll = this.onLevelLoading.bind(this);
    _observer2['default'].on(_events2['default'].MANIFEST_LOADING, this.onml);
    _observer2['default'].on(_events2['default'].LEVEL_LOADING, this.onll);
  }

  _createClass(PlaylistLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      this.url = this.id = null;
      _observer2['default'].off(_events2['default'].MANIFEST_LOADING, this.onml);
      _observer2['default'].off(_events2['default'].LEVEL_LOADING, this.onll);
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
      this.loader = new config.loader(config);
      this.loader.load(url, '', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.manifestLoadingTimeOut, config.manifestLoadingMaxRetry, config.manifestLoadingRetryDelay);
    }
  }, {
    key: 'resolve',
    value: function resolve(url, baseUrl) {
      var doc = document,
          oldBase = doc.getElementsByTagName('base')[0],
          oldHref = oldBase && oldBase.href,
          docHead = doc.head || doc.getElementsByTagName('head')[0],
          ourBase = oldBase || docHead.appendChild(doc.createElement('base')),
          resolver = doc.createElement('a'),
          resolvedUrl;
      ourBase.href = baseUrl;
      resolver.href = url;
      resolvedUrl = resolver.href; // browser magic at work here
      if (oldBase) {
        oldBase.href = oldHref;
      } else {
        docHead.removeChild(ourBase);
      }
      return resolvedUrl;
    }
  }, {
    key: 'parseMasterPlaylist',
    value: function parseMasterPlaylist(string, baseurl) {
      var levels = [],
          level = {},
          result,
          codecs,
          codec;
      var re = /#EXT-X-STREAM-INF:([^\n\r]*(BAND)WIDTH=(\d+))?([^\n\r]*(CODECS)=\"(.*)\",)?([^\n\r]*(RES)OLUTION=(\d+)x(\d+))?([^\n\r]*(NAME)=\"(.*)\")?[^\n\r]*[\r\n]+([^\r\n]+)/g;
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
    key: 'parseLevelPlaylist',
    value: function parseLevelPlaylist(string, baseurl, id) {
      var currentSN = 0,
          totalduration = 0,
          level = { url: baseurl, fragments: [], live: true, startSN: 0 },
          result,
          regexp,
          cc = 0;
      regexp = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT(INF):([\d\.]+)[^\r\n]*[\r\n]+([^\r\n]+)|(?:#EXT-X-(ENDLIST))|(?:#EXT-X-(DIS)CONTINUITY))/g;
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
          case 'INF':
            var duration = parseFloat(result[1]);
            level.fragments.push({ url: this.resolve(result[2], baseurl), duration: duration, start: totalduration, sn: currentSN++, level: id, cc: cc });
            totalduration += duration;
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
          levels;
      // responseURL not supported on some browsers (it is used to detect URL redirection)
      if (url === undefined) {
        // fallback to initial URL
        url = this.url;
      }
      stats.tload = new Date();
      stats.mtime = new Date(event.currentTarget.getResponseHeader('Last-Modified'));
      if (string.indexOf('#EXTM3U') === 0) {
        if (string.indexOf('#EXTINF:') > 0) {
          // 1 level playlist
          // if first request, fire manifest loaded event, level will be reloaded afterwards
          // (this is to have a uniform logic for 1 level/multilevel playlists)
          if (this.id === null) {
            _observer2['default'].trigger(_events2['default'].MANIFEST_LOADED, { levels: [{ url: url }], url: url, stats: stats });
          } else {
            _observer2['default'].trigger(_events2['default'].LEVEL_LOADED, { details: this.parseLevelPlaylist(string, url, id), level: id, id: id2, stats: stats });
          }
        } else {
          levels = this.parseMasterPlaylist(string, url);
          // multi level playlist, parse level info
          if (levels.length) {
            _observer2['default'].trigger(_events2['default'].MANIFEST_LOADED, { levels: levels, url: url, stats: stats });
          } else {
            _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no level found in manifest' });
          }
        }
      } else {
        _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no EXTM3U delimiter' });
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
      _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, response: event.currentTarget, level: this.id, id: this.id2 });
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
      _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, level: this.id, id: this.id2 });
    }
  }]);

  return PlaylistLoader;
})();

exports['default'] = PlaylistLoader;
module.exports = exports['default'];

},{"../errors":9,"../events":10,"../observer":14}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var observer = new _events2['default']();

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

exports['default'] = observer;
module.exports = exports['default'];

},{"events":1}],15:[function(require,module,exports){
/**
 * Generate MP4 Box
*/

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
          i;
      // assemble the SPSs
      for (i = 0; i < track.sps.length; i++) {
        sps.push(track.sps[i].byteLength >>> 8 & 0xFF);
        sps.push(track.sps[i].byteLength & 0xFF); // sequenceParameterSetLength
        sps = sps.concat(Array.prototype.slice.call(track.sps[i])); // SPS
      }
      // assemble the PPSs
      for (i = 0; i < track.pps.length; i++) {
        pps.push(track.pps[i].byteLength >>> 8 & 0xFF);
        pps.push(track.pps[i].byteLength & 0xFF);
        pps = pps.concat(Array.prototype.slice.call(track.pps[i]));
      }
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
      MP4.box(MP4.types.avcC, new Uint8Array([0x01, // configurationVersion
      track.profileIdc, // AVCProfileIndication
      track.profileCompat, // profile_compatibility
      track.levelIdc, // AVCLevelIndication
      0xff // lengthSizeMinusOne, hard-coded to 4 bytes
      ].concat([track.sps.length // numOfSequenceParameterSets
      ]).concat(sps).concat([track.pps.length // numOfPictureParameterSets
      ]).concat(pps))), // "PPS"
      MP4.box(MP4.types.btrt, new Uint8Array([0x00, 0x1c, 0x9c, 0x80, // bufferSizeDB
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

},{}],16:[function(require,module,exports){
/**
 * Stats handler
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

var _observer = require('./observer');

var _observer2 = _interopRequireDefault(_observer);

var StatsHandler = (function () {
  function StatsHandler(hls) {
    _classCallCheck(this, StatsHandler);

    this.hls = hls;
    this.onmp = this.onManifestParsed.bind(this);
    this.onfc = this.onFragmentChanged.bind(this);
    this.onfb = this.onFragmentBuffered.bind(this);
    this.onflea = this.onFragmentLoadEmergencyAborted.bind(this);
    this.onerr = this.onError.bind(this);
    this.onfpsd = this.onFPSDrop.bind(this);
    _observer2['default'].on(_events2['default'].MANIFEST_PARSED, this.onmp);
    _observer2['default'].on(_events2['default'].FRAG_BUFFERED, this.onfb);
    _observer2['default'].on(_events2['default'].FRAG_CHANGED, this.onfc);
    _observer2['default'].on(_events2['default'].ERROR, this.onerr);
    _observer2['default'].on(_events2['default'].FRAG_LOAD_EMERGENCY_ABORTED, this.onflea);
    _observer2['default'].on(_events2['default'].FPS_DROP, this.onfpsd);
  }

  _createClass(StatsHandler, [{
    key: 'destroy',
    value: function destroy() {
      _observer2['default'].off(_events2['default'].MANIFEST_PARSED, this.onmp);
      _observer2['default'].off(_events2['default'].FRAG_BUFFERED, this.onfb);
      _observer2['default'].off(_events2['default'].FRAG_CHANGED, this.onfc);
      _observer2['default'].off(_events2['default'].ERROR, this.onerr);
      _observer2['default'].off(_events2['default'].FRAG_LOAD_EMERGENCY_ABORTED, this.onflea);
      _observer2['default'].off(_events2['default'].FPS_DROP, this.onfpsd);
    }
  }, {
    key: 'attachVideo',
    value: function attachVideo(video) {
      this.video = video;
    }
  }, {
    key: 'detachVideo',
    value: function detachVideo() {
      this.video = null;
    }

    // reset stats on manifest parsed
  }, {
    key: 'onManifestParsed',
    value: function onManifestParsed(event, data) {
      this._stats = { tech: 'hls.js', levelNb: data.levels.length };
    }

    // on fragment changed is triggered whenever playback of a new fragment is starting ...
  }, {
    key: 'onFragmentChanged',
    value: function onFragmentChanged(event, data) {
      var stats = this._stats,
          level = data.frag.level,
          autoLevel = data.frag.autoLevel;
      if (stats) {
        if (stats.levelStart === undefined) {
          stats.levelStart = level;
        }
        if (autoLevel) {
          if (stats.fragChangedAuto) {
            stats.autoLevelMin = Math.min(stats.autoLevelMin, level);
            stats.autoLevelMax = Math.max(stats.autoLevelMax, level);
            stats.fragChangedAuto++;
            if (this.levelLastAuto && level !== stats.autoLevelLast) {
              stats.autoLevelSwitch++;
            }
          } else {
            stats.autoLevelMin = stats.autoLevelMax = level;
            stats.autoLevelSwitch = 0;
            stats.fragChangedAuto = 1;
            this.sumAutoLevel = 0;
          }
          this.sumAutoLevel += level;
          stats.autoLevelAvg = Math.round(1000 * this.sumAutoLevel / stats.fragChangedAuto) / 1000;
          stats.autoLevelLast = level;
        } else {
          if (stats.fragChangedManual) {
            stats.manualLevelMin = Math.min(stats.manualLevelMin, level);
            stats.manualLevelMax = Math.max(stats.manualLevelMax, level);
            stats.fragChangedManual++;
            if (!this.levelLastAuto && level !== stats.manualLevelLast) {
              stats.manualLevelSwitch++;
            }
          } else {
            stats.manualLevelMin = stats.manualLevelMax = level;
            stats.manualLevelSwitch = 0;
            stats.fragChangedManual = 1;
          }
          stats.manualLevelLast = level;
        }
        this.levelLastAuto = autoLevel;
      }
    }

    // triggered each time a new fragment is buffered
  }, {
    key: 'onFragmentBuffered',
    value: function onFragmentBuffered(event, data) {
      var stats = this._stats,
          latency = data.stats.tfirst - data.stats.trequest,
          process = data.stats.tbuffered - data.stats.trequest,
          bitrate = Math.round(8 * data.stats.length / (data.stats.tbuffered - data.stats.tfirst));
      if (stats.fragBuffered) {
        stats.fragMinLatency = Math.min(stats.fragMinLatency, latency);
        stats.fragMaxLatency = Math.max(stats.fragMaxLatency, latency);
        stats.fragMinProcess = Math.min(stats.fragMinProcess, process);
        stats.fragMaxProcess = Math.max(stats.fragMaxProcess, process);
        stats.fragMinKbps = Math.min(stats.fragMinKbps, bitrate);
        stats.fragMaxKbps = Math.max(stats.fragMaxKbps, bitrate);
        stats.autoLevelCappingMin = Math.min(stats.autoLevelCappingMin, this.hls.autoLevelCapping);
        stats.autoLevelCappingMax = Math.max(stats.autoLevelCappingMax, this.hls.autoLevelCapping);
        stats.fragBuffered++;
      } else {
        stats.fragMinLatency = stats.fragMaxLatency = latency;
        stats.fragMinProcess = stats.fragMaxProcess = process;
        stats.fragMinKbps = stats.fragMaxKbps = bitrate;
        stats.fragBuffered = 1;
        stats.fragBufferedBytes = 0;
        stats.autoLevelCappingMin = stats.autoLevelCappingMax = this.hls.autoLevelCapping;
        this.sumLatency = 0;
        this.sumKbps = 0;
        this.sumProcess = 0;
      }
      stats.fraglastLatency = latency;
      this.sumLatency += latency;
      stats.fragAvgLatency = Math.round(this.sumLatency / stats.fragBuffered);
      stats.fragLastProcess = process;
      this.sumProcess += process;
      stats.fragAvgProcess = Math.round(this.sumProcess / stats.fragBuffered);
      stats.fragLastKbps = bitrate;
      this.sumKbps += bitrate;
      stats.fragAvgKbps = Math.round(this.sumKbps / stats.fragBuffered);
      stats.fragBufferedBytes += data.stats.length;
      stats.autoLevelCappingLast = this.hls.autoLevelCapping;
    }
  }, {
    key: 'onFragmentLoadEmergencyAborted',
    value: function onFragmentLoadEmergencyAborted() {
      var stats = this._stats;
      if (stats) {
        if (stats.fragLoadEmergencyAborted === undefined) {
          stats.fragLoadEmergencyAborted = 1;
        } else {
          stats.fragLoadEmergencyAborted++;
        }
      }
    }
  }, {
    key: 'onError',
    value: function onError(event, data) {
      var stats = this._stats;
      if (stats) {
        // track all errors independently
        if (stats[data.details] === undefined) {
          stats[data.details] = 1;
        } else {
          stats[data.details] += 1;
        }
        // track fatal error
        if (data.fatal) {
          if (stats.fatalError === undefined) {
            stats.fatalError = 1;
          } else {
            stats.fatalError += 1;
          }
        }
      }
    }
  }, {
    key: 'onFPSDrop',
    value: function onFPSDrop(event, data) {
      var stats = this._stats;
      if (stats) {
        if (stats.fpsDropEvent === undefined) {
          stats.fpsDropEvent = 1;
        } else {
          stats.fpsDropEvent++;
        }
        stats.fpsTotalDroppedFrames = data.totalDroppedFrames;
      }
    }
  }, {
    key: 'stats',
    get: function get() {
      if (this.video) {
        this._stats.lastPos = this.video.currentTime.toFixed(3);
      }
      return this._stats;
    }
  }]);

  return StatsHandler;
})();

exports['default'] = StatsHandler;
module.exports = exports['default'];

},{"./events":10,"./observer":14}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
function noop() {}

var fakeLogger = {
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};

var exportedLogger = fakeLogger;

var enableLogs = function enableLogs(debug) {
  if (debug === true || typeof debug === 'object') {
    exportedLogger.log = debug.log ? debug.log.bind(debug) : console.log.bind(console);
    exportedLogger.info = debug.info ? debug.info.bind(debug) : console.info.bind(console);
    exportedLogger.error = debug.error ? debug.error.bind(debug) : console.error.bind(console);
    exportedLogger.warn = debug.warn ? debug.warn.bind(debug) : console.warn.bind(console);
    // Some browsers don't allow to use bind on console object anyway
    // fallback to default if needed
    try {
      exportedLogger.log();
    } catch (e) {
      exportedLogger.log = noop;
      exportedLogger.info = noop;
      exportedLogger.error = noop;
      exportedLogger.warn = noop;
    }
  } else {
    exportedLogger = fakeLogger;
  }
};

exports.enableLogs = enableLogs;
var logger = exportedLogger;
exports.logger = logger;

},{}],18:[function(require,module,exports){
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

      this.url = url;
      this.responseType = responseType;
      this.onSuccess = onSuccess;
      this.onProgress = onProgress;
      this.onTimeout = onTimeout;
      this.onError = onError;
      this.stats = { trequest: new Date(), retry: 0 };
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
      this.stats.tload = new Date();
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
        stats.tfirst = new Date();
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

},{"../utils/logger":17}]},{},[11])(11)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2Vycm9ycy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZXZlbnRzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9obHMuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9mcmFnbWVudC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL29ic2VydmVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9yZW11eC9tcDQtZ2VuZXJhdG9yLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9zdGF0cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvbG9nZ2VyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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QUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7T0FDVCxDQUFDOztBQUVGLFVBQUksQ0FBQyxDQUFDO0FBQ04sV0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtBQUNuQixZQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQy9CLGFBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FDYixDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNmLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQ2YsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFD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QUFDLFVBQVUsS0FBSyxDQUFDLEdBQUksSUFBSSxDQUFDLENBQUM7QUFDakQsV0FBRyxDQUFDLElBQUksQ0FBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUUsQ0FBQztBQUMzQyxXQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDNUQ7O0FBRUQsV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNyQyxXQUFHLENBQUMsSUFBSSxDQUFDLEFBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxHQUFJLElBQUksQ0FBQyxDQUFDO0FBQ2pELFdBQUcsQ0FBQyxJQUFJLENBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFFLENBQUM7QUFDM0MsV0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQzVEO0FBQ0QsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksVUFBVSxDQUFDLENBQzFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUNoQixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDaEIsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJ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RyxDQUFJLENBQUM7QUFDekQsWUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztPQUNyQjtLQUNGOzs7V0FFVSxxQkFBQyxLQUFLLEVBQUU7QUFDakIsMEJBQU8sSUFBSSw0QkFBMEIsSUFBSSxDQUFDLEdBQUcsQ0FBSSxDQUFDO0FBQ2xELFVBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNuQzs7O1dBRVcsc0JBQUMsS0FBSyxFQUFFO0FBQ2xCLFVBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDdkIsVUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtBQUN6QixhQUFLLENBQUMsTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7T0FDM0I7QUFDRCxXQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDNUIsVUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ25CLFlBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO09BQy9CO0tBQ0Y7OztTQXhGRyxTQUFTOzs7cUJBMkZBLFNBQVMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIGJ1bmRsZUZuID0gYXJndW1lbnRzWzNdO1xudmFyIHNvdXJjZXMgPSBhcmd1bWVudHNbNF07XG52YXIgY2FjaGUgPSBhcmd1bWVudHNbNV07XG5cbnZhciBzdHJpbmdpZnkgPSBKU09OLnN0cmluZ2lmeTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciB3a2V5O1xuICAgIHZhciBjYWNoZUtleXMgPSBPYmplY3Qua2V5cyhjYWNoZSk7XG4gICAgXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgIGlmIChjYWNoZVtrZXldLmV4cG9ydHMgPT09IGZuKSB7XG4gICAgICAgICAgICB3a2V5ID0ga2V5O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKCF3a2V5KSB7XG4gICAgICAgIHdrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgdmFyIHdjYWNoZSA9IHt9O1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgICAgICB3Y2FjaGVba2V5XSA9IGtleTtcbiAgICAgICAgfVxuICAgICAgICBzb3VyY2VzW3drZXldID0gW1xuICAgICAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJywnbW9kdWxlJywnZXhwb3J0cyddLCAnKCcgKyBmbiArICcpKHNlbGYpJyksXG4gICAgICAgICAgICB3Y2FjaGVcbiAgICAgICAgXTtcbiAgICB9XG4gICAgdmFyIHNrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICBcbiAgICB2YXIgc2NhY2hlID0ge307IHNjYWNoZVt3a2V5XSA9IHdrZXk7XG4gICAgc291cmNlc1tza2V5XSA9IFtcbiAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJ10sJ3JlcXVpcmUoJyArIHN0cmluZ2lmeSh3a2V5KSArICcpKHNlbGYpJyksXG4gICAgICAgIHNjYWNoZVxuICAgIF07XG4gICAgXG4gICAgdmFyIHNyYyA9ICcoJyArIGJ1bmRsZUZuICsgJykoeydcbiAgICAgICAgKyBPYmplY3Qua2V5cyhzb3VyY2VzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ2lmeShrZXkpICsgJzpbJ1xuICAgICAgICAgICAgICAgICsgc291cmNlc1trZXldWzBdXG4gICAgICAgICAgICAgICAgKyAnLCcgKyBzdHJpbmdpZnkoc291cmNlc1trZXldWzFdKSArICddJ1xuICAgICAgICAgICAgO1xuICAgICAgICB9KS5qb2luKCcsJylcbiAgICAgICAgKyAnfSx7fSxbJyArIHN0cmluZ2lmeShza2V5KSArICddKSdcbiAgICA7XG4gICAgXG4gICAgdmFyIFVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTCB8fCB3aW5kb3cubW96VVJMIHx8IHdpbmRvdy5tc1VSTDtcbiAgICBcbiAgICByZXR1cm4gbmV3IFdvcmtlcihVUkwuY3JlYXRlT2JqZWN0VVJMKFxuICAgICAgICBuZXcgQmxvYihbc3JjXSwgeyB0eXBlOiAndGV4dC9qYXZhc2NyaXB0JyB9KVxuICAgICkpO1xufTtcbiIsIi8qXG4gKiBCdWZmZXIgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgRGVtdXhlciBmcm9tICcuLi9kZW11eC9kZW11eGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBCdWZmZXJDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLkVSUk9SID0gLTI7XG4gICAgdGhpcy5TVEFSVElORyA9IC0xO1xuICAgIHRoaXMuSURMRSA9IDA7XG4gICAgdGhpcy5MT0FESU5HID0gIDE7XG4gICAgdGhpcy5XQUlUSU5HX0xFVkVMID0gMjtcbiAgICB0aGlzLlBBUlNJTkcgPSAzO1xuICAgIHRoaXMuUEFSU0VEID0gNDtcbiAgICB0aGlzLkFQUEVORElORyA9IDU7XG4gICAgdGhpcy5CVUZGRVJfRkxVU0hJTkcgPSA2O1xuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSAwO1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIC8vIFNvdXJjZSBCdWZmZXIgbGlzdGVuZXJzXG4gICAgdGhpcy5vbnNidWUgPSB0aGlzLm9uU291cmNlQnVmZmVyVXBkYXRlRW5kLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnNiZSAgPSB0aGlzLm9uU291cmNlQnVmZmVyRXJyb3IuYmluZCh0aGlzKTtcbiAgICAvLyBpbnRlcm5hbCBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1TRUF0dGFjaGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZWQgPSB0aGlzLm9uTVNFRGV0YWNoZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXAgPSB0aGlzLm9uTWFuaWZlc3RQYXJzZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmwgPSB0aGlzLm9uRnJhZ21lbnRMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uaXMgPSB0aGlzLm9uSW5pdFNlZ21lbnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZnBnID0gdGhpcy5vbkZyYWdtZW50UGFyc2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcCA9IHRoaXMub25GcmFnbWVudFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25lcnIgPSB0aGlzLm9uRXJyb3IuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1TRV9BVFRBQ0hFRCwgdGhpcy5vbm1zZSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTVNFX0RFVEFDSEVELCB0aGlzLm9ubXNlZCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICAgIC8vIHJlbW92ZSB2aWRlbyBsaXN0ZW5lclxuICAgIGlmICh0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLCB0aGlzLm9udnNlZWtpbmcpO1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgdGhpcy5vbnZtZXRhZGF0YSk7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgdGhpcy5vbnZlbmRlZCk7XG4gICAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9udnNlZWtlZCA9IHRoaXMub252bWV0YWRhdGEgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICB9XG5cbiAgc3RhcnRMb2FkKCkge1xuICAgIGlmICh0aGlzLmxldmVscyAmJiB0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnN0YXJ0SW50ZXJuYWwoKTtcbiAgICAgIGlmICh0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICBsb2dnZXIubG9nKGBzZWVraW5nIEAgJHt0aGlzLmxhc3RDdXJyZW50VGltZX1gKTtcbiAgICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWU7XG4gICAgICAgIGlmICghdGhpcy5sYXN0UGF1c2VkKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygncmVzdW1pbmcgdmlkZW8nKTtcbiAgICAgICAgICB0aGlzLnZpZGVvLnBsYXkoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5TVEFSVElORztcbiAgICAgIH1cbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignY2Fubm90IHN0YXJ0IGxvYWRpbmcgYXMgZWl0aGVyIG1hbmlmZXN0IG5vdCBwYXJzZWQgb3IgdmlkZW8gbm90IGF0dGFjaGVkJyk7XG4gICAgfVxuICB9XG5cbiAgc3RhcnRJbnRlcm5hbCgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcih0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgIHRoaXMubGV2ZWwgPSAtMTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB0aGlzLm9uZnBnKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgdGhpcy5vbmZwKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLm1wNHNlZ21lbnRzID0gW107XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IFtdO1xuICAgIGlmICh0aGlzLmZyYWcpIHtcbiAgICAgIGlmICh0aGlzLmZyYWcubG9hZGVyKSB7XG4gICAgICAgIHRoaXMuZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHZhciBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlU291cmNlQnVmZmVyKHNiKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5kZW11eGVyKSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX1BBUlNFRCwgdGhpcy5vbmZwKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdmFyIHBvcywgbGV2ZWwsIGxldmVsRGV0YWlscywgZnJhZ0lkeDtcbiAgICBzd2l0Y2godGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSB0aGlzLkVSUk9SOlxuICAgICAgICAvL2Rvbid0IGRvIGFueXRoaW5nIGluIGVycm9yIHN0YXRlIHRvIGF2b2lkIGJyZWFraW5nIGZ1cnRoZXIgLi4uXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSB0aGlzLlNUQVJUSU5HOlxuICAgICAgICAvLyBkZXRlcm1pbmUgbG9hZCBsZXZlbFxuICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSB0aGlzLmhscy5zdGFydExldmVsO1xuICAgICAgICBpZiAodGhpcy5zdGFydExldmVsID09PSAtMSkge1xuICAgICAgICAgIC8vIC0xIDogZ3Vlc3Mgc3RhcnQgTGV2ZWwgYnkgZG9pbmcgYSBiaXRyYXRlIHRlc3QgYnkgbG9hZGluZyBmaXJzdCBmcmFnbWVudCBvZiBsb3dlc3QgcXVhbGl0eSBsZXZlbFxuICAgICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IDA7XG4gICAgICAgICAgdGhpcy5mcmFnbWVudEJpdHJhdGVUZXN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBzZXQgbmV3IGxldmVsIHRvIHBsYXlsaXN0IGxvYWRlciA6IHRoaXMgd2lsbCB0cmlnZ2VyIHN0YXJ0IGxldmVsIGxvYWRcbiAgICAgICAgdGhpcy5sZXZlbCA9IHRoaXMuaGxzLm5leHRMb2FkTGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLldBSVRJTkdfTEVWRUw7XG4gICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuSURMRTpcbiAgICAgICAgLy8gaGFuZGxlIGVuZCBvZiBpbW1lZGlhdGUgc3dpdGNoaW5nIGlmIG5lZWRlZFxuICAgICAgICBpZiAodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgICAgICB0aGlzLmltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgdmlkZW8gZGV0YWNoZWQgb3IgdW5ib3VuZCBleGl0IGxvb3BcbiAgICAgICAgaWYgKCF0aGlzLnZpZGVvKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2VlayBiYWNrIHRvIGEgZXhwZWN0ZWQgcG9zaXRpb24gYWZ0ZXIgdmlkZW8gc3RhbGxpbmdcbiAgICAgICAgaWYgKHRoaXMuc2Vla0FmdGVyU3RhbGxpbmcpIHtcbiAgICAgICAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lID0gdGhpcy5zZWVrQWZ0ZXJTdGFsbGluZztcbiAgICAgICAgICB0aGlzLnNlZWtBZnRlclN0YWxsaW5nID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGNhbmRpZGF0ZSBmcmFnbWVudCB0byBiZSBsb2FkZWQsIGJhc2VkIG9uIGN1cnJlbnQgcG9zaXRpb24gYW5kXG4gICAgICAgIC8vICBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgIC8vICBlbnN1cmUgNjBzIG9mIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIHdlIGhhdmUgbm90IHlldCBsb2FkZWQgYW55IGZyYWdtZW50LCBzdGFydCBsb2FkaW5nIGZyb20gc3RhcnQgcG9zaXRpb25cbiAgICAgICAgaWYgKHRoaXMubG9hZGVkbWV0YWRhdGEpIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBvcyA9IHRoaXMubmV4dExvYWRQb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBsb2FkIGxldmVsXG4gICAgICAgIGlmICh0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgbGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gd2UgYXJlIG5vdCBhdCBwbGF5YmFjayBzdGFydCwgZ2V0IG5leHQgbG9hZCBsZXZlbCBmcm9tIGxldmVsIENvbnRyb2xsZXJcbiAgICAgICAgICBsZXZlbCA9IHRoaXMuaGxzLm5leHRMb2FkTGV2ZWw7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSB0aGlzLmJ1ZmZlckluZm8ocG9zKSwgYnVmZmVyTGVuID0gYnVmZmVySW5mby5sZW4sIGJ1ZmZlckVuZCA9IGJ1ZmZlckluZm8uZW5kLCBtYXhCdWZMZW47XG4gICAgICAgIC8vIGNvbXB1dGUgbWF4IEJ1ZmZlciBMZW5ndGggdGhhdCB3ZSBjb3VsZCBnZXQgZnJvbSB0aGlzIGxvYWQgbGV2ZWwsIGJhc2VkIG9uIGxldmVsIGJpdHJhdGUuIGRvbid0IGJ1ZmZlciBtb3JlIHRoYW4gNjAgTUIgYW5kIG1vcmUgdGhhbiAzMHNcbiAgICAgICAgaWYgKCh0aGlzLmxldmVsc1tsZXZlbF0pLmhhc093blByb3BlcnR5KCdiaXRyYXRlJykpIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1heCg4ICogdGhpcy5jb25maWcubWF4QnVmZmVyU2l6ZSAvIHRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlLCB0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWluKG1heEJ1ZkxlbiwgdGhpcy5jb25maWcubWF4TWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSB0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gbWF4QnVmTGVuIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICAgIGlmIChidWZmZXJMZW4gPCBtYXhCdWZMZW4pIHtcbiAgICAgICAgICAvLyBzZXQgbmV4dCBsb2FkIGxldmVsIDogdGhpcyB3aWxsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkIGlmIG5lZWRlZFxuICAgICAgICAgIHRoaXMuaGxzLm5leHRMb2FkTGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgICAgbGV2ZWxEZXRhaWxzID0gdGhpcy5sZXZlbHNbbGV2ZWxdLmRldGFpbHM7XG4gICAgICAgICAgLy8gaWYgbGV2ZWwgaW5mbyBub3QgcmV0cmlldmVkIHlldCwgc3dpdGNoIHN0YXRlIGFuZCB3YWl0IGZvciBsZXZlbCByZXRyaWV2YWxcbiAgICAgICAgICBpZiAodHlwZW9mIGxldmVsRGV0YWlscyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLldBSVRJTkdfTEVWRUw7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZmluZCBmcmFnbWVudCBpbmRleCwgY29udGlndW91cyB3aXRoIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgICBsZXQgZnJhZ21lbnRzID0gbGV2ZWxEZXRhaWxzLmZyYWdtZW50cywgZnJhZywgc2xpZGluZyA9IGxldmVsRGV0YWlscy5zbGlkaW5nLCBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCArIHNsaWRpbmcsIGRyaWZ0ID0gMDtcbiAgICAgICAgICAvLyBjaGVjayBpZiByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgd2l0aGluIHNlZWthYmxlIGJvdW5kYXJpZXMgOlxuICAgICAgICAgIC8vIGluIGNhc2Ugb2YgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0IHJlcXVlc3RlZCBwb3NpdGlvbiBpcyBub3QgbG9jYXRlZCBiZWZvcmUgcGxheWxpc3Qgc3RhcnRcbiAgICAgICAgICAvL2xvZ2dlci5sb2coYHN0YXJ0L3Bvcy9idWZFbmQvc2Vla2luZzoke3N0YXJ0LnRvRml4ZWQoMyl9LyR7cG9zLnRvRml4ZWQoMyl9LyR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9LyR7dGhpcy52aWRlby5zZWVraW5nfWApO1xuICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBzdGFydCkge1xuICAgICAgICAgICAgICB0aGlzLnNlZWtBZnRlclN0YWxsaW5nID0gdGhpcy5zdGFydFBvc2l0aW9uICsgc2xpZGluZztcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYnVmZmVyIGVuZDogJHtidWZmZXJFbmR9IGlzIGxvY2F0ZWQgYmVmb3JlIHN0YXJ0IG9mIGxpdmUgc2xpZGluZyBwbGF5bGlzdCwgbWVkaWEgcG9zaXRpb24gd2lsbCBiZSByZXNldGVkIHRvOiAke3RoaXMuc2Vla0FmdGVyU3RhbGxpbmcudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgYnVmZmVyRW5kID0gdGhpcy5zZWVrQWZ0ZXJTdGFsbGluZztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGxldmVsRGV0YWlscy5saXZlICYmIGxldmVsRGV0YWlscy5zbGlkaW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8qIHdlIGFyZSBzd2l0Y2hpbmcgbGV2ZWwgb24gbGl2ZSBwbGF5bGlzdCwgYnV0IHdlIGRvbid0IGhhdmUgYW55IHNsaWRpbmcgaW5mbyAuLi5cbiAgICAgICAgICAgICAgIHRyeSB0byBsb2FkIGZyYWcgbWF0Y2hpbmcgd2l0aCBuZXh0IFNOLlxuICAgICAgICAgICAgICAgZXZlbiBpZiBTTiBhcmUgbm90IHN5bmNocm9uaXplZCBiZXR3ZWVuIHBsYXlsaXN0cywgbG9hZGluZyB0aGlzIGZyYWcgd2lsbCBoZWxwIHVzXG4gICAgICAgICAgICAgICBjb21wdXRlIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZSBhZnRlciBpbiBjYXNlIGl0IHdhcyBub3QgdGhlIHJpZ2h0IGNvbnNlY3V0aXZlIG9uZSAqL1xuICAgICAgICAgICAgaWYgKHRoaXMuZnJhZykge1xuICAgICAgICAgICAgICB2YXIgdGFyZ2V0U04gPSB0aGlzLmZyYWcuc24gKyAxO1xuICAgICAgICAgICAgICBpZiAodGFyZ2V0U04gPj0gbGV2ZWxEZXRhaWxzLnN0YXJ0U04gJiYgdGFyZ2V0U04gPD0gbGV2ZWxEZXRhaWxzLmVuZFNOKSB7XG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1t0YXJnZXRTTiAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIGxvYWQgZnJhZyB3aXRoIG5leHQgU046ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFmcmFnKSB7XG4gICAgICAgICAgICAgIC8qIHdlIGhhdmUgbm8gaWRlYSBhYm91dCB3aGljaCBmcmFnbWVudCBzaG91bGQgYmUgbG9hZGVkLlxuICAgICAgICAgICAgICAgICBzbyBsZXQncyBsb2FkIG1pZCBmcmFnbWVudC4gaXQgd2lsbCBoZWxwIGNvbXB1dGluZyBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmVcbiAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tNYXRoLnJvdW5kKGZyYWdtZW50cy5sZW5ndGggLyAyKV07XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgdW5rbm93biwgbG9hZCBtaWRkbGUgZnJhZyA6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vbG9vayBmb3IgZnJhZ21lbnRzIG1hdGNoaW5nIHdpdGggY3VycmVudCBwbGF5IHBvc2l0aW9uXG4gICAgICAgICAgICBmb3IgKGZyYWdJZHggPSAwOyBmcmFnSWR4IDwgZnJhZ21lbnRzLmxlbmd0aDsgZnJhZ0lkeCsrKSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeF07XG4gICAgICAgICAgICAgIHN0YXJ0ID0gZnJhZy5zdGFydCtzbGlkaW5nO1xuICAgICAgICAgICAgICBpZiAoZnJhZy5kcmlmdCkge1xuICAgICAgICAgICAgICAgIGRyaWZ0ID0gZnJhZy5kcmlmdDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBzdGFydCArPSBkcmlmdDtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdsZXZlbC9zbi9zbGlkaW5nL2RyaWZ0L3N0YXJ0L2VuZC9idWZFbmQ6JHtsZXZlbH0vJHtmcmFnLnNufS8ke3NsaWRpbmcudG9GaXhlZCgzKX0vJHtkcmlmdC50b0ZpeGVkKDMpfS8ke3N0YXJ0LnRvRml4ZWQoMyl9LyR7KHN0YXJ0K2ZyYWcuZHVyYXRpb24pLnRvRml4ZWQoMyl9LyR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9Jyk7XG4gICAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5XG4gICAgICAgICAgICAgIGlmIChzdGFydCA8PSBidWZmZXJFbmQgJiYgKHN0YXJ0ICsgZnJhZy5kdXJhdGlvbikgPiBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZyYWdJZHggPT09IGZyYWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgLy8gcmVhY2ggZW5kIG9mIHBsYXlsaXN0XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIFNOIG1hdGNoaW5nIHdpdGggcG9zOicgKyAgYnVmZmVyRW5kICsgJzonICsgZnJhZy5zbik7XG4gICAgICAgICAgICBpZiAodGhpcy5mcmFnICYmIGZyYWcuc24gPT09IHRoaXMuZnJhZy5zbikge1xuICAgICAgICAgICAgICBpZiAoZnJhZ0lkeCA9PT0gKGZyYWdtZW50cy5sZW5ndGggLTEpKSB7XG4gICAgICAgICAgICAgICAgLy8gd2UgYXJlIGF0IHRoZSBlbmQgb2YgdGhlIHBsYXlsaXN0IGFuZCB3ZSBhbHJlYWR5IGxvYWRlZCBsYXN0IGZyYWdtZW50LCBkb24ndCBkbyBhbnl0aGluZ1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeCArIDFdO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfSwgY3VycmVudFRpbWU6JHtwb3N9LGJ1ZmZlckVuZDoke2J1ZmZlckVuZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnICAgICAgbG9hZGluZyBmcmFnICcgKyBpICsnLHBvcy9idWZFbmQ6JyArIHBvcy50b0ZpeGVkKDMpICsgJy8nICsgYnVmZmVyRW5kLnRvRml4ZWQoMykpO1xuICAgICAgICAgIGZyYWcuZHJpZnQgPSBkcmlmdDtcbiAgICAgICAgICBmcmFnLmF1dG9MZXZlbCA9IHRoaXMuaGxzLmF1dG9MZXZlbEVuYWJsZWQ7XG4gICAgICAgICAgaWYgKHRoaXMubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBNYXRoLnJvdW5kKGZyYWcuZHVyYXRpb24gKiB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSAvIDgpO1xuICAgICAgICAgICAgZnJhZy50cmVxdWVzdCA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGVuc3VyZSB0aGF0IHdlIGFyZSBub3QgcmVsb2FkaW5nIHRoZSBzYW1lIGZyYWdtZW50cyBpbiBsb29wIC4uLlxuICAgICAgICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHgrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChmcmFnLmxvYWRDb3VudGVyKSB7XG4gICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyKys7XG4gICAgICAgICAgICBsZXQgbWF4VGhyZXNob2xkID0gdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgICAgICAgLy8gaWYgdGhpcyBmcmFnIGhhcyBhbHJlYWR5IGJlZW4gbG9hZGVkIDMgdGltZXMsIGFuZCBpZiBpdCBoYXMgYmVlbiByZWxvYWRlZCByZWNlbnRseVxuICAgICAgICAgICAgaWYgKGZyYWcubG9hZENvdW50ZXIgPiBtYXhUaHJlc2hvbGQgJiYgKE1hdGguYWJzKHRoaXMuZnJhZ0xvYWRJZHggLSBmcmFnLmxvYWRJZHgpIDwgbWF4VGhyZXNob2xkKSkge1xuICAgICAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZnJhZy5sb2FkSWR4ID0gdGhpcy5mcmFnTG9hZElkeDtcbiAgICAgICAgICB0aGlzLmZyYWcgPSBmcmFnO1xuICAgICAgICAgIHRoaXMuc3RhcnRGcmFnbWVudFJlcXVlc3RlZCA9IHRydWU7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURJTkcsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuTE9BRElORztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5XQUlUSU5HX0xFVkVMOlxuICAgICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICBpZiAobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuTE9BRElORzpcbiAgICAgICAgLypcbiAgICAgICAgICBtb25pdG9yIGZyYWdtZW50IHJldHJpZXZhbCB0aW1lLi4uXG4gICAgICAgICAgd2UgY29tcHV0ZSBleHBlY3RlZCB0aW1lIG9mIGFycml2YWwgb2YgdGhlIGNvbXBsZXRlIGZyYWdtZW50LlxuICAgICAgICAgIHdlIGNvbXBhcmUgaXQgdG8gZXhwZWN0ZWQgdGltZSBvZiBidWZmZXIgc3RhcnZhdGlvblxuICAgICAgICAqL1xuICAgICAgICBsZXQgdiA9IHRoaXMudmlkZW8sZnJhZyA9IHRoaXMuZnJhZztcbiAgICAgICAgLyogb25seSBtb25pdG9yIGZyYWcgcmV0cmlldmFsIHRpbWUgaWZcbiAgICAgICAgKHZpZGVvIG5vdCBwYXVzZWQgT1IgZmlyc3QgZnJhZ21lbnQgYmVpbmcgbG9hZGVkKSBBTkQgYXV0b3N3aXRjaGluZyBlbmFibGVkIEFORCBub3QgbG93ZXN0IGxldmVsIEFORCBtdWx0aXBsZSBsZXZlbHMgKi9cbiAgICAgICAgaWYgKHYgJiYgKCF2LnBhdXNlZCB8fCB0aGlzLmxvYWRlZG1ldGFkYXRhID09PSBmYWxzZSkgJiYgZnJhZy5hdXRvTGV2ZWwgJiYgdGhpcy5sZXZlbCAmJiB0aGlzLmxldmVscy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgdmFyIHJlcXVlc3REZWxheSA9IG5ldyBEYXRlKCkgLSBmcmFnLnRyZXF1ZXN0O1xuICAgICAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICAgICAgaWYgKHJlcXVlc3REZWxheSA+ICg1MDAgKiBmcmFnLmR1cmF0aW9uKSkge1xuICAgICAgICAgICAgdmFyIGxvYWRSYXRlID0gZnJhZy5sb2FkZWQgKiAxMDAwIC8gcmVxdWVzdERlbGF5OyAvLyBieXRlL3NcbiAgICAgICAgICAgIGlmIChmcmFnLmV4cGVjdGVkTGVuIDwgZnJhZy5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IGZyYWcubG9hZGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcG9zID0gdi5jdXJyZW50VGltZTtcbiAgICAgICAgICAgIHZhciBmcmFnTG9hZGVkRGVsYXkgPSAoZnJhZy5leHBlY3RlZExlbiAtIGZyYWcubG9hZGVkKSAvIGxvYWRSYXRlO1xuICAgICAgICAgICAgdmFyIGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA9IHRoaXMuYnVmZmVySW5mbyhwb3MpLmVuZCAtIHBvcztcbiAgICAgICAgICAgIHZhciBmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkgPSBmcmFnLmR1cmF0aW9uICogdGhpcy5sZXZlbHNbdGhpcy5obHMubmV4dExvYWRMZXZlbF0uYml0cmF0ZSAvICg4ICogbG9hZFJhdGUpOyAvL2Jwcy9CcHNcbiAgICAgICAgICAgIC8qIGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBkdXJhdGlvbiBpbiBidWZmZXIgYW5kIGlmIGZyYWcgbG9hZGVkIGRlbGF5IGlzIGdyZWF0ZXIgdGhhbiBidWZmZXIgc3RhcnZhdGlvbiBkZWxheVxuICAgICAgICAgICAgICAuLi4gYW5kIGFsc28gYmlnZ2VyIHRoYW4gZHVyYXRpb24gbmVlZGVkIHRvIGxvYWQgZnJhZ21lbnQgYXQgbmV4dCBsZXZlbCAuLi4qL1xuICAgICAgICAgICAgaWYgKGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA8ICgyICogZnJhZy5kdXJhdGlvbikgJiYgZnJhZ0xvYWRlZERlbGF5ID4gYnVmZmVyU3RhcnZhdGlvbkRlbGF5ICYmIGZyYWdMb2FkZWREZWxheSA+IGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIC4uLlxuICAgICAgICAgICAgICBsb2dnZXIud2FybignbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZycpO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmcmFnTG9hZGVkRGVsYXkvYnVmZmVyU3RhcnZhdGlvbkRlbGF5L2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA6JHtmcmFnTG9hZGVkRGVsYXkudG9GaXhlZCgxKX0vJHtidWZmZXJTdGFydmF0aW9uRGVsYXkudG9GaXhlZCgxKX0vJHtmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkudG9GaXhlZCgxKX1gKTtcbiAgICAgICAgICAgICAgLy9hYm9ydCBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIHRvIHJlcXVlc3QgbmV3IGZyYWdtZW50IGF0IGxvd2VzdCBsZXZlbFxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5QQVJTSU5HOlxuICAgICAgICAvLyBub3RoaW5nIHRvIGRvLCB3YWl0IGZvciBmcmFnbWVudCBiZWluZyBwYXJzZWRcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuUEFSU0VEOlxuICAgICAgY2FzZSB0aGlzLkFQUEVORElORzpcbiAgICAgICAgaWYgKHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgICAgLy8gaWYgTVA0IHNlZ21lbnQgYXBwZW5kaW5nIGluIHByb2dyZXNzIG5vdGhpbmcgdG8gZG9cbiAgICAgICAgICBpZiAoKHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvICYmIHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvLnVwZGF0aW5nKSB8fFxuICAgICAgICAgICAgICh0aGlzLnNvdXJjZUJ1ZmZlci52aWRlbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci52aWRlby51cGRhdGluZykpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnc2IgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgIC8vIGNoZWNrIGlmIGFueSBNUDQgc2VnbWVudHMgbGVmdCB0byBhcHBlbmRcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubXA0c2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VnbWVudCA9IHRoaXMubXA0c2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9Jyk7XG4gICAgICAgICAgICAgIHRoaXMuc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0uYXBwZW5kQnVmZmVyKHNlZ21lbnQuZGF0YSk7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAwO1xuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgLy8gaW4gY2FzZSBhbnkgZXJyb3Igb2NjdXJlZCB3aGlsZSBhcHBlbmRpbmcsIHB1dCBiYWNrIHNlZ21lbnQgaW4gbXA0c2VnbWVudHMgdGFibGVcbiAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBlcnJvciB3aGlsZSB0cnlpbmcgdG8gYXBwZW5kIGJ1ZmZlcjoke2Vyci5tZXNzYWdlfSx0cnkgYXBwZW5kaW5nIGxhdGVyYCk7XG4gICAgICAgICAgICAgIHRoaXMubXA0c2VnbWVudHMudW5zaGlmdChzZWdtZW50KTtcbiAgICAgICAgICAgICAgaWYgKHRoaXMuYXBwZW5kRXJyb3IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvciA9IDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGV2ZW50ID0ge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0FQUEVORElOR19FUlJPUiwgZnJhZzogdGhpcy5mcmFnfTtcbiAgICAgICAgICAgICAgLyogd2l0aCBVSEQgY29udGVudCwgd2UgY291bGQgZ2V0IGxvb3Agb2YgcXVvdGEgZXhjZWVkZWQgZXJyb3IgdW50aWxcbiAgICAgICAgICAgICAgICBicm93c2VyIGlzIGFibGUgdG8gZXZpY3Qgc29tZSBkYXRhIGZyb20gc291cmNlYnVmZmVyLiByZXRyeWluZyBoZWxwIHJlY292ZXJpbmcgdGhpc1xuICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvciA+IHRoaXMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnkpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmYWlsICR7dGhpcy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeX0gdGltZXMgdG8gYXBwZW5kIHNlZ21lbnQgaW4gc291cmNlQnVmZmVyYCk7XG4gICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5FUlJPUjtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLkFQUEVORElORztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gc291cmNlQnVmZmVyIHVuZGVmaW5lZCwgc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZVxuICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuQlVGRkVSX0ZMVVNISU5HOlxuICAgICAgICAvLyBsb29wIHRocm91Z2ggYWxsIGJ1ZmZlciByYW5nZXMgdG8gZmx1c2hcbiAgICAgICAgd2hpbGUodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCkge1xuICAgICAgICAgIHZhciByYW5nZSA9IHRoaXMuZmx1c2hSYW5nZVswXTtcbiAgICAgICAgICAvLyBmbHVzaEJ1ZmZlciB3aWxsIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzIGFuZCBmbHVzaCBBdWRpby9WaWRlbyBCdWZmZXJcbiAgICAgICAgICBpZiAodGhpcy5mbHVzaEJ1ZmZlcihyYW5nZS5zdGFydCwgcmFuZ2UuZW5kKSkge1xuICAgICAgICAgICAgLy8gcmFuZ2UgZmx1c2hlZCwgcmVtb3ZlIGZyb20gZmx1c2ggYXJyYXlcbiAgICAgICAgICAgIHRoaXMuZmx1c2hSYW5nZS5zaGlmdCgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmbHVzaCBpbiBwcm9ncmVzcywgY29tZSBiYWNrIGxhdGVyXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBtb3ZlIHRvIElETEUgb25jZSBmbHVzaCBjb21wbGV0ZS4gdGhpcyBzaG91bGQgdHJpZ2dlciBuZXcgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgICAgLy8gcmVzZXQgcmVmZXJlbmNlIHRvIGZyYWdcbiAgICAgICAgICB0aGlzLmZyYWcgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgICAvKiBpZiBub3QgZXZlcnl0aGluZyBmbHVzaGVkLCBzdGF5IGluIEJVRkZFUl9GTFVTSElORyBzdGF0ZS4gd2Ugd2lsbCBjb21lIGJhY2sgaGVyZVxuICAgICAgICAgICAgZWFjaCB0aW1lIHNvdXJjZUJ1ZmZlciB1cGRhdGVlbmQoKSBjYWxsYmFjayB3aWxsIGJlIHRyaWdnZXJlZFxuICAgICAgICAgICAgKi9cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLy8gY2hlY2svdXBkYXRlIGN1cnJlbnQgZnJhZ21lbnRcbiAgICB0aGlzLl9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpO1xuICB9XG5cbiAgIGJ1ZmZlckluZm8ocG9zKSB7XG4gICAgdmFyIHYgPSB0aGlzLnZpZGVvLFxuICAgICAgICBidWZmZXJlZCA9IHYuYnVmZmVyZWQsXG4gICAgICAgIGJ1ZmZlckxlbixcbiAgICAgICAgLy8gYnVmZmVyU3RhcnQgYW5kIGJ1ZmZlckVuZCBhcmUgYnVmZmVyIGJvdW5kYXJpZXMgYXJvdW5kIGN1cnJlbnQgdmlkZW8gcG9zaXRpb25cbiAgICAgICAgYnVmZmVyU3RhcnQsIGJ1ZmZlckVuZCxcbiAgICAgICAgaTtcbiAgICB2YXIgYnVmZmVyZWQyID0gW107XG4gICAgLy8gdGhlcmUgbWlnaHQgYmUgc29tZSBzbWFsbCBob2xlcyBiZXR3ZWVuIGJ1ZmZlciB0aW1lIHJhbmdlXG4gICAgLy8gY29uc2lkZXIgdGhhdCBob2xlcyBzbWFsbGVyIHRoYW4gMzAwIG1zIGFyZSBpcnJlbGV2YW50IGFuZCBidWlsZCBhbm90aGVyXG4gICAgLy8gYnVmZmVyIHRpbWUgcmFuZ2UgcmVwcmVzZW50YXRpb25zIHRoYXQgZGlzY2FyZHMgdGhvc2UgaG9sZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vbG9nZ2VyLmxvZygnYnVmIHN0YXJ0L2VuZDonICsgYnVmZmVyZWQuc3RhcnQoaSkgKyAnLycgKyBidWZmZXJlZC5lbmQoaSkpO1xuICAgICAgaWYgKChidWZmZXJlZDIubGVuZ3RoKSAmJiAoYnVmZmVyZWQuc3RhcnQoaSkgLSBidWZmZXJlZDJbYnVmZmVyZWQyLmxlbmd0aCAtIDFdLmVuZCkgPCAwLjMpIHtcbiAgICAgICAgYnVmZmVyZWQyW2J1ZmZlcmVkMi5sZW5ndGggLSAxXS5lbmQgPSBidWZmZXJlZC5lbmQoaSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidWZmZXJlZDIucHVzaCh7c3RhcnQ6IGJ1ZmZlcmVkLnN0YXJ0KGkpLCBlbmQ6IGJ1ZmZlcmVkLmVuZChpKX0pO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvczsgaSA8IGJ1ZmZlcmVkMi5sZW5ndGg7IGkrKykge1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZiAoKHBvcyArIDAuMykgPj0gYnVmZmVyZWQyW2ldLnN0YXJ0ICYmIHBvcyA8IGJ1ZmZlcmVkMltpXS5lbmQpIHtcbiAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyZWQyW2ldLnN0YXJ0O1xuICAgICAgICBidWZmZXJFbmQgPSBidWZmZXJlZDJbaV0uZW5kICsgMC4zO1xuICAgICAgICBidWZmZXJMZW4gPSBidWZmZXJFbmQgLSBwb3M7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7bGVuOiBidWZmZXJMZW4sIHN0YXJ0OiBidWZmZXJTdGFydCwgZW5kOiBidWZmZXJFbmR9O1xuICB9XG5cbiAgZ2V0QnVmZmVyUmFuZ2UocG9zaXRpb24pIHtcbiAgICB2YXIgaSwgcmFuZ2U7XG4gICAgZm9yIChpID0gdGhpcy5idWZmZXJSYW5nZS5sZW5ndGggLSAxOyBpID49MDsgaS0tKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZiAocG9zaXRpb24gPj0gcmFuZ2Uuc3RhcnQgJiYgcG9zaXRpb24gPD0gcmFuZ2UuZW5kKSB7XG4gICAgICAgIHJldHVybiByYW5nZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIGlmICh0aGlzLnZpZGVvKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUpO1xuICAgICAgaWYgKHJhbmdlKSB7XG4gICAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBnZXQgbmV4dEJ1ZmZlclJhbmdlKCkge1xuICAgIGlmICh0aGlzLnZpZGVvKSB7XG4gICAgICAvLyBmaXJzdCBnZXQgZW5kIHJhbmdlIG9mIGN1cnJlbnQgZnJhZ21lbnRcbiAgICAgIHJldHVybiB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmb2xsb3dpbmdCdWZmZXJSYW5nZShyYW5nZSkge1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgLy8gdHJ5IHRvIGdldCByYW5nZSBvZiBuZXh0IGZyYWdtZW50ICg1MDBtcyBhZnRlciB0aGlzIHJhbmdlKVxuICAgICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyUmFuZ2UocmFuZ2UuZW5kICsgMC41KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHZhciByYW5nZSA9IHRoaXMubmV4dEJ1ZmZlclJhbmdlO1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gIH1cblxuICBpc0J1ZmZlcmVkKHBvc2l0aW9uKSB7XG4gICAgdmFyIHYgPSB0aGlzLnZpZGVvLCBidWZmZXJlZCA9IHYuYnVmZmVyZWQ7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHBvc2l0aW9uID49IGJ1ZmZlcmVkLnN0YXJ0KGkpICYmIHBvc2l0aW9uIDw9IGJ1ZmZlcmVkLmVuZChpKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCkge1xuICAgIHZhciByYW5nZUN1cnJlbnQsIGN1cnJlbnRUaW1lO1xuICAgIGlmICh0aGlzLnZpZGVvICYmIHRoaXMudmlkZW8uc2Vla2luZyA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gY3VycmVudFRpbWUgPSB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSkpIHtcbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSArIDAuMSkpIHtcbiAgICAgICAgLyogZW5zdXJlIHRoYXQgRlJBR19DSEFOR0VEIGV2ZW50IGlzIHRyaWdnZXJlZCBhdCBzdGFydHVwLFxuICAgICAgICAgIHdoZW4gZmlyc3QgdmlkZW8gZnJhbWUgaXMgZGlzcGxheWVkIGFuZCBwbGF5YmFjayBpcyBwYXVzZWQuXG4gICAgICAgICAgYWRkIGEgdG9sZXJhbmNlIG9mIDEwMG1zLCBpbiBjYXNlIGN1cnJlbnQgcG9zaXRpb24gaXMgbm90IGJ1ZmZlcmVkLFxuICAgICAgICAgIGNoZWNrIGlmIGN1cnJlbnQgcG9zKzEwMG1zIGlzIGJ1ZmZlcmVkIGFuZCB1c2UgdGhhdCBidWZmZXIgcmFuZ2VcbiAgICAgICAgICBmb3IgRlJBR19DSEFOR0VEIGV2ZW50IHJlcG9ydGluZyAqL1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lICsgMC4xKTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZUN1cnJlbnQpIHtcbiAgICAgICAgaWYgKHJhbmdlQ3VycmVudC5mcmFnICE9PSB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IHJhbmdlQ3VycmVudC5mcmFnO1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19DSEFOR0VELCB7ZnJhZzogdGhpcy5mcmFnQ3VycmVudH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIHN0cmVhbSBpcyBWT0QgKG5vdCBsaXZlKSBhbmQgd2UgcmVhY2ggRW5kIG9mIFN0cmVhbVxuICAgICAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAgICAgaWYgKGxldmVsICYmIGxldmVsLmRldGFpbHMgJiYgIWxldmVsLmRldGFpbHMubGl2ZSkge1xuICAgICAgICAgIC8vIGFyZSB3ZSBwbGF5aW5nIGxhc3QgZnJhZ21lbnQgP1xuICAgICAgICAgIGlmIChyYW5nZUN1cnJlbnQuZnJhZy5zbiA9PT0gbGV2ZWwuZGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgaWYgKHRoaXMubWVkaWFTb3VyY2UgJiYgdGhpcy5tZWRpYVNvdXJjZS5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnYWxsIG1lZGlhIGRhdGEgYXZhaWxhYmxlLCBzaWduYWwgZW5kT2ZTdHJlYW0oKSB0byBNZWRpYVNvdXJjZScpO1xuICAgICAgICAgICAgICAvL05vdGlmeSB0aGUgbWVkaWEgZWxlbWVudCB0aGF0IGl0IG5vdyBoYXMgYWxsIG9mIHRoZSBtZWRpYSBkYXRhXG4gICAgICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKlxuICAgIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzLCBhbmQgZmx1c2ggYWxsIGJ1ZmZlcmVkIGRhdGFcbiAgICByZXR1cm4gdHJ1ZSBvbmNlIGV2ZXJ5dGhpbmcgaGFzIGJlZW4gZmx1c2hlZC5cbiAgICBzb3VyY2VCdWZmZXIuYWJvcnQoKSBhbmQgc291cmNlQnVmZmVyLnJlbW92ZSgpIGFyZSBhc3luY2hyb25vdXMgb3BlcmF0aW9uc1xuICAgIHRoZSBpZGVhIGlzIHRvIGNhbGwgdGhpcyBmdW5jdGlvbiBmcm9tIHRpY2soKSB0aW1lciBhbmQgY2FsbCBpdCBhZ2FpbiB1bnRpbCBhbGwgcmVzb3VyY2VzIGhhdmUgYmVlbiBjbGVhbmVkXG4gICAgdGhlIHRpbWVyIGlzIHJlYXJtZWQgdXBvbiBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgZXZlbnQsIHNvIHRoaXMgc2hvdWxkIGJlIG9wdGltYWxcbiAgKi9cbiAgZmx1c2hCdWZmZXIoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCkge1xuICAgIHZhciBzYiwgaSwgYnVmU3RhcnQsIGJ1ZkVuZCwgZmx1c2hTdGFydCwgZmx1c2hFbmQ7XG4gICAgLy9sb2dnZXIubG9nKCdmbHVzaEJ1ZmZlcixwb3Mvc3RhcnQvZW5kOiAnICsgdGhpcy52aWRlby5jdXJyZW50VGltZSArICcvJyArIHN0YXJ0T2Zmc2V0ICsgJy8nICsgZW5kT2Zmc2V0KTtcbiAgICAvLyBzYWZlZ3VhcmQgdG8gYXZvaWQgaW5maW5pdGUgbG9vcGluZ1xuICAgIGlmICh0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrIDwgKDIgKiB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCkgJiYgdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvciAodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgaWYgKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYnVmU3RhcnQgPSBzYi5idWZmZXJlZC5zdGFydChpKTtcbiAgICAgICAgICAgIGJ1ZkVuZCA9IHNiLmJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgICAgICAgIC8vIHdvcmthcm91bmQgZmlyZWZveCBub3QgYWJsZSB0byBwcm9wZXJseSBmbHVzaCBtdWx0aXBsZSBidWZmZXJlZCByYW5nZS5cbiAgICAgICAgICAgIGlmIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiBlbmRPZmZzZXQgPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gc3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gZW5kT2Zmc2V0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IE1hdGgubWF4KGJ1ZlN0YXJ0LCBzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLCBlbmRPZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogc29tZXRpbWVzIHNvdXJjZWJ1ZmZlci5yZW1vdmUoKSBkb2VzIG5vdCBmbHVzaFxuICAgICAgICAgICAgICAgdGhlIGV4YWN0IGV4cGVjdGVkIHRpbWUgcmFuZ2UuXG4gICAgICAgICAgICAgICB0byBhdm9pZCByb3VuZGluZyBpc3N1ZXMvaW5maW5pdGUgbG9vcCxcbiAgICAgICAgICAgICAgIG9ubHkgZmx1c2ggYnVmZmVyIHJhbmdlIG9mIGxlbmd0aCBncmVhdGVyIHRoYW4gNTAwbXMuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKGZsdXNoRW5kIC0gZmx1c2hTdGFydCA+IDAuNSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmbHVzaCAke3R5cGV9IFske2ZsdXNoU3RhcnR9LCR7Zmx1c2hFbmR9XSwgb2YgWyR7YnVmU3RhcnR9LCR7YnVmRW5kfV0sIHBvczoke3RoaXMudmlkZW8uY3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHNiLnJlbW92ZShmbHVzaFN0YXJ0LCBmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5idWZmZXJSYW5nZS5sZW5ndGg7IGkrKykge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZCgocmFuZ2Uuc3RhcnQgKyByYW5nZS5lbmQpIC8gMikpIHtcbiAgICAgICAgbmV3UmFuZ2UucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBuZXdSYW5nZTtcbiAgICBsb2dnZXIubG9nKCdidWZmZXIgZmx1c2hlZCcpO1xuICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZCAhXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKlxuICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggOlxuICAgICAtIHBhdXNlIHBsYXliYWNrIGlmIHBsYXlpbmdcbiAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgIC0gYW5kIHRyaWdnZXIgYSBidWZmZXIgZmx1c2hcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKSB7XG4gICAgbG9nZ2VyLmxvZygnaW1tZWRpYXRlTGV2ZWxTd2l0Y2gnKTtcbiAgICBpZiAoIXRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzbHlQYXVzZWQgPSB0aGlzLnZpZGVvLnBhdXNlZDtcbiAgICAgIHRoaXMudmlkZW8ucGF1c2UoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuZnJhZyAmJiB0aGlzLmZyYWcubG9hZGVyKSB7XG4gICAgICB0aGlzLmZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgLy8gZmx1c2ggZXZlcnl0aGluZ1xuICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IDAsIGVuZDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgLy8gdHJpZ2dlciBhIHNvdXJjZUJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuc3RhdGUgPSB0aGlzLkJVRkZFUl9GTFVTSElORztcbiAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIC8qXG4gICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggZW5kLCBhZnRlciBuZXcgZnJhZ21lbnQgaGFzIGJlZW4gYnVmZmVyZWQgOlxuICAgICAgLSBudWRnZSB2aWRlbyBkZWNvZGVyIGJ5IHNsaWdodGx5IGFkanVzdGluZyB2aWRlbyBjdXJyZW50VGltZVxuICAgICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpIHtcbiAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IGZhbHNlO1xuICAgIHRoaXMudmlkZW8uY3VycmVudFRpbWUgLT0gMC4wMDAxO1xuICAgIGlmICghdGhpcy5wcmV2aW91c2x5UGF1c2VkKSB7XG4gICAgICB0aGlzLnZpZGVvLnBsYXkoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0TGV2ZWxTd2l0Y2goKSB7XG4gICAgLyogdHJ5IHRvIHN3aXRjaCBBU0FQIHdpdGhvdXQgYnJlYWtpbmcgdmlkZW8gcGxheWJhY2sgOlxuICAgICAgIGluIG9yZGVyIHRvIGVuc3VyZSBzbW9vdGggYnV0IHF1aWNrIGxldmVsIHN3aXRjaGluZyxcbiAgICAgIHdlIG5lZWQgdG8gZmluZCB0aGUgbmV4dCBmbHVzaGFibGUgYnVmZmVyIHJhbmdlXG4gICAgICB3ZSBzaG91bGQgdGFrZSBpbnRvIGFjY291bnQgbmV3IHNlZ21lbnQgZmV0Y2ggdGltZVxuICAgICovXG4gICAgdmFyIGZldGNoZGVsYXksIGN1cnJlbnRSYW5nZSwgbmV4dFJhbmdlO1xuICAgIGN1cnJlbnRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSk7XG4gICAgaWYgKGN1cnJlbnRSYW5nZSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IDAsIGVuZDogY3VycmVudFJhbmdlLnN0YXJ0IC0gMX0pO1xuICAgIH1cbiAgICBpZiAoIXRoaXMudmlkZW8ucGF1c2VkKSB7XG4gICAgICAvLyBhZGQgYSBzYWZldHkgZGVsYXkgb2YgMXNcbiAgICAgIHZhciBuZXh0TGV2ZWxJZCA9IHRoaXMuaGxzLm5leHRMb2FkTGV2ZWwsbmV4dExldmVsID0gdGhpcy5sZXZlbHNbbmV4dExldmVsSWRdO1xuICAgICAgaWYgKHRoaXMuaGxzLnN0YXRzLmZyYWdMYXN0S2JwcyAmJiB0aGlzLmZyYWcpIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IHRoaXMuZnJhZy5kdXJhdGlvbiAqIG5leHRMZXZlbC5iaXRyYXRlIC8gKDEwMDAgKiB0aGlzLmhscy5zdGF0cy5mcmFnTGFzdEticHMpICsgMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmZXRjaGRlbGF5OicrZmV0Y2hkZWxheSk7XG4gICAgLy8gZmluZCBidWZmZXIgcmFuZ2UgdGhhdCB3aWxsIGJlIHJlYWNoZWQgb25jZSBuZXcgZnJhZ21lbnQgd2lsbCBiZSBmZXRjaGVkXG4gICAgbmV4dFJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lICsgZmV0Y2hkZWxheSk7XG4gICAgaWYgKG5leHRSYW5nZSkge1xuICAgICAgLy8gd2UgY2FuIGZsdXNoIGJ1ZmZlciByYW5nZSBmb2xsb3dpbmcgdGhpcyBvbmUgd2l0aG91dCBzdGFsbGluZyBwbGF5YmFja1xuICAgICAgbmV4dFJhbmdlID0gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZShuZXh0UmFuZ2UpO1xuICAgICAgaWYgKG5leHRSYW5nZSkge1xuICAgICAgICAvLyBmbHVzaCBwb3NpdGlvbiBpcyB0aGUgc3RhcnQgcG9zaXRpb24gb2YgdGhpcyBuZXcgYnVmZmVyXG4gICAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHtzdGFydDogbmV4dFJhbmdlLnN0YXJ0LCBlbmQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCkge1xuICAgICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgICAgLy8gdHJpZ2dlciBhIHNvdXJjZUJ1ZmZlciBmbHVzaFxuICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuQlVGRkVSX0ZMVVNISU5HO1xuICAgICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25NU0VBdHRhY2hlZChldmVudCwgZGF0YSkge1xuICAgIHRoaXMudmlkZW8gPSBkYXRhLnZpZGVvO1xuICAgIHRoaXMubWVkaWFTb3VyY2UgPSBkYXRhLm1lZGlhU291cmNlO1xuICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub25WaWRlb1NlZWtpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udnNlZWtlZCA9IHRoaXMub25WaWRlb1NlZWtlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252bWV0YWRhdGEgPSB0aGlzLm9uVmlkZW9NZXRhZGF0YS5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252ZW5kZWQgPSB0aGlzLm9uVmlkZW9FbmRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIHRoaXMub252bWV0YWRhdGEpO1xuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCB0aGlzLm9udmVuZGVkKTtcbiAgICBpZih0aGlzLmxldmVscyAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uTVNFRGV0YWNoZWQoKSB7XG4gICAgdGhpcy52aWRlbyA9IG51bGw7XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgIHRoaXMuc3RvcCgpO1xuICB9XG5cbiAgb25WaWRlb1NlZWtpbmcoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IHRoaXMuTE9BRElORykge1xuICAgICAgLy8gY2hlY2sgaWYgY3VycmVudGx5IGxvYWRlZCBmcmFnbWVudCBpcyBpbnNpZGUgYnVmZmVyLlxuICAgICAgLy9pZiBvdXRzaWRlLCBjYW5jZWwgZnJhZ21lbnQgbG9hZGluZywgb3RoZXJ3aXNlIGRvIG5vdGhpbmdcbiAgICAgIGlmICh0aGlzLmJ1ZmZlckluZm8odGhpcy52aWRlby5jdXJyZW50VGltZSkubGVuID09PSAwKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ3NlZWtpbmcgb3V0c2lkZSBvZiBidWZmZXIgd2hpbGUgZnJhZ21lbnQgbG9hZCBpbiBwcm9ncmVzcywgY2FuY2VsIGZyYWdtZW50IGxvYWQnKTtcbiAgICAgICAgdGhpcy5mcmFnLmxvYWRlci5hYm9ydCgpO1xuICAgICAgICB0aGlzLmZyYWcgPSBudWxsO1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBsb2FkIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy52aWRlbykge1xuICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lO1xuICAgIH1cbiAgICAvLyBhdm9pZCByZXBvcnRpbmcgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIGluIGNhc2UgdXNlciBpcyBzZWVraW5nIHNldmVyYWwgdGltZXMgb24gc2FtZSBwb3NpdGlvblxuICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICB9XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBwcm9jZXNzaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblZpZGVvU2Vla2VkKCkge1xuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgRlJBR01FTlRfUExBWUlORyB0cmlnZ2VyaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblZpZGVvTWV0YWRhdGEoKSB7XG4gICAgaWYgKHRoaXMudmlkZW8uY3VycmVudFRpbWUgIT09IHRoaXMuc3RhcnRQb3NpdGlvbikge1xuICAgICAgdGhpcy52aWRlby5jdXJyZW50VGltZSA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICB9XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IHRydWU7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblZpZGVvRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygndmlkZW8gZW5kZWQnKTtcbiAgICAvLyByZXNldCBzdGFydFBvc2l0aW9uIGFuZCBsYXN0Q3VycmVudFRpbWUgdG8gcmVzdGFydCBwbGF5YmFjayBAIHN0cmVhbSBiZWdpbm5pbmdcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gIH1cblxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgYWFjID0gZmFsc2UsIGhlYWFjID0gZmFsc2UsIGNvZGVjcztcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIC8vIGRldGVjdCBpZiB3ZSBoYXZlIGRpZmZlcmVudCBraW5kIG9mIGF1ZGlvIGNvZGVjcyB1c2VkIGFtb25nc3QgcGxheWxpc3RzXG4gICAgICBjb2RlY3MgPSBsZXZlbC5jb2RlY3M7XG4gICAgICBpZiAoY29kZWNzKSB7XG4gICAgICAgIGlmIChjb2RlY3MuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xKSB7XG4gICAgICAgICAgYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29kZWNzLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkge1xuICAgICAgICAgIGhlYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYXVkaW9jb2RlY3N3aXRjaCA9IChhYWMgJiYgaGVhYWMpO1xuICAgIGlmICh0aGlzLmF1ZGlvY29kZWNzd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBhdWRpbyBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgICBpZiAodGhpcy52aWRlbyAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBuZXdMZXZlbERldGFpbHMgPSBkYXRhLmRldGFpbHMsXG4gICAgICAgIGR1cmF0aW9uID0gbmV3TGV2ZWxEZXRhaWxzLnRvdGFsZHVyYXRpb24sXG4gICAgICAgIG5ld0xldmVsSWQgPSBkYXRhLmxldmVsLFxuICAgICAgICBuZXdMZXZlbCA9IHRoaXMubGV2ZWxzW25ld0xldmVsSWRdLFxuICAgICAgICBjdXJMZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICBzbGlkaW5nID0gMDtcbiAgICBsb2dnZXIubG9nKGBsZXZlbCAke25ld0xldmVsSWR9IGxvYWRlZCBbJHtuZXdMZXZlbERldGFpbHMuc3RhcnRTTn0sJHtuZXdMZXZlbERldGFpbHMuZW5kU059XSxkdXJhdGlvbjoke2R1cmF0aW9ufWApO1xuICAgIC8vIGNoZWNrIGlmIHBsYXlsaXN0IGlzIGFscmVhZHkgbG9hZGVkIChpZiB5ZXMsIGl0IHNob3VsZCBiZSBhIGxpdmUgcGxheWxpc3QpXG4gICAgaWYgKGN1ckxldmVsICYmIGN1ckxldmVsLmRldGFpbHMgJiYgY3VyTGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICB2YXIgY3VyTGV2ZWxEZXRhaWxzID0gY3VyTGV2ZWwuZGV0YWlscztcbiAgICAgIC8vICBwbGF5bGlzdCBzbGlkaW5nIGlzIHRoZSBzdW0gb2YgOiBjdXJyZW50IHBsYXlsaXN0IHNsaWRpbmcgKyBzbGlkaW5nIG9mIG5ldyBwbGF5bGlzdCBjb21wYXJlZCB0byBjdXJyZW50IG9uZVxuICAgICAgLy8gY2hlY2sgc2xpZGluZyBvZiB1cGRhdGVkIHBsYXlsaXN0IGFnYWluc3QgY3VycmVudCBvbmUgOlxuICAgICAgLy8gYW5kIGZpbmQgaXRzIHBvc2l0aW9uIGluIGN1cnJlbnQgcGxheWxpc3RcbiAgICAgIC8vbG9nZ2VyLmxvZyhcImZyYWdtZW50c1swXS5zbi90aGlzLmxldmVsL2N1ckxldmVsLmRldGFpbHMuZnJhZ21lbnRzWzBdLnNuOlwiICsgZnJhZ21lbnRzWzBdLnNuICsgXCIvXCIgKyB0aGlzLmxldmVsICsgXCIvXCIgKyBjdXJMZXZlbC5kZXRhaWxzLmZyYWdtZW50c1swXS5zbik7XG4gICAgICB2YXIgU05kaWZmID0gbmV3TGV2ZWxEZXRhaWxzLnN0YXJ0U04gLSBjdXJMZXZlbERldGFpbHMuc3RhcnRTTjtcbiAgICAgIGlmIChTTmRpZmYgPj0gMCkge1xuICAgICAgICAvLyBwb3NpdGl2ZSBzbGlkaW5nIDogbmV3IHBsYXlsaXN0IHNsaWRpbmcgd2luZG93IGlzIGFmdGVyIHByZXZpb3VzIG9uZVxuICAgICAgICB2YXIgb2xkZnJhZ21lbnRzID0gY3VyTGV2ZWxEZXRhaWxzLmZyYWdtZW50cztcbiAgICAgICAgaWYgKFNOZGlmZiA8IG9sZGZyYWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICBzbGlkaW5nID0gY3VyTGV2ZWxEZXRhaWxzLnNsaWRpbmcgKyBvbGRmcmFnbWVudHNbU05kaWZmXS5zdGFydDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBjYW5ub3QgY29tcHV0ZSBzbGlkaW5nLCBubyBTTiBpbiBjb21tb24gYmV0d2VlbiBvbGQvbmV3IGxldmVsOlske2N1ckxldmVsRGV0YWlscy5zdGFydFNOfSwke2N1ckxldmVsRGV0YWlscy5lbmRTTn1dL1ske25ld0xldmVsRGV0YWlscy5zdGFydFNOfSwke25ld0xldmVsRGV0YWlscy5lbmRTTn1dYCk7XG4gICAgICAgICAgc2xpZGluZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbmVnYXRpdmUgc2xpZGluZzogbmV3IHBsYXlsaXN0IHNsaWRpbmcgd2luZG93IGlzIGJlZm9yZSBwcmV2aW91cyBvbmVcbiAgICAgICAgc2xpZGluZyA9IGN1ckxldmVsRGV0YWlscy5zbGlkaW5nIC0gbmV3TGV2ZWxEZXRhaWxzLmZyYWdtZW50c1stU05kaWZmXS5zdGFydDtcbiAgICAgIH1cbiAgICAgIGlmIChzbGlkaW5nKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3Qgc2xpZGluZzoke3NsaWRpbmcudG9GaXhlZCgzKX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgbGV2ZWwgaW5mb1xuICAgIG5ld0xldmVsLmRldGFpbHMgPSBuZXdMZXZlbERldGFpbHM7XG4gICAgbmV3TGV2ZWwuZGV0YWlscy5zbGlkaW5nID0gc2xpZGluZztcbiAgICBpZiAodGhpcy5zdGFydExldmVsTG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tM1xuICAgICAgaWYgKG5ld0xldmVsRGV0YWlscy5saXZlKSB7XG4gICAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IE1hdGgubWF4KDAsIGR1cmF0aW9uIC0gMyAqIG5ld0xldmVsRGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBvbmx5IHN3aXRjaCBiYXRjayB0byBJRExFIHN0YXRlIGlmIHdlIHdlcmUgd2FpdGluZyBmb3IgbGV2ZWwgdG8gc3RhcnQgZG93bmxvYWRpbmcgYSBuZXcgZnJhZ21lbnRcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gdGhpcy5XQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkZWQoZXZlbnQsIGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gdGhpcy5MT0FESU5HKSB7XG4gICAgICBpZiAodGhpcy5mcmFnbWVudEJpdHJhdGVUZXN0ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgLi4uIHdlIGp1c3QgbG9hZGVkIGEgZnJhZ21lbnQgdG8gZGV0ZXJtaW5lIGFkZXF1YXRlIHN0YXJ0IGJpdHJhdGUgYW5kIGluaXRpYWxpemUgYXV0b3N3aXRjaCBhbGdvXG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9IGZhbHNlO1xuICAgICAgICBkYXRhLnN0YXRzLnRwYXJzZWQgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiBkYXRhLnN0YXRzLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLlBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSwgZGV0YWlscyA9IGN1cnJlbnRMZXZlbC5kZXRhaWxzLCBkdXJhdGlvbiA9IGRldGFpbHMudG90YWxkdXJhdGlvbiwgc3RhcnQgPSB0aGlzLmZyYWcuc3RhcnQ7XG4gICAgICAgIGlmIChkZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICBkdXJhdGlvbiArPSBkZXRhaWxzLnNsaWRpbmc7XG4gICAgICAgICAgc3RhcnQgKz0gZGV0YWlscy5zbGlkaW5nO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmZyYWcuZHJpZnQpIHtcbiAgICAgICAgICBzdGFydCArPSB0aGlzLmZyYWcuZHJpZnQ7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmxvZyhgRGVtdXhpbmcgJHt0aGlzLmZyYWcuc259IG9mIFske2RldGFpbHMuc3RhcnRTTn0gLCR7ZGV0YWlscy5lbmRTTn1dLGxldmVsICR7dGhpcy5sZXZlbH1gKTtcbiAgICAgICAgdGhpcy5kZW11eGVyLnB1c2goZGF0YS5wYXlsb2FkLCBjdXJyZW50TGV2ZWwuYXVkaW9Db2RlYywgY3VycmVudExldmVsLnZpZGVvQ29kZWMsIHN0YXJ0LCB0aGlzLmZyYWcuY2MsIHRoaXMubGV2ZWwsIGR1cmF0aW9uKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkluaXRTZWdtZW50KGV2ZW50LCBkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IHRoaXMuUEFSU0lORykge1xuICAgICAgLy8gY2hlY2sgaWYgY29kZWNzIGhhdmUgYmVlbiBleHBsaWNpdGVseSBkZWZpbmVkIGluIHRoZSBtYXN0ZXIgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWw7XG4gICAgICAvLyBpZiB5ZXMgdXNlIHRoZXNlIG9uZXMgaW5zdGVhZCBvZiB0aGUgb25lcyBwYXJzZWQgZnJvbSB0aGUgZGVtdXhcbiAgICAgIHZhciBhdWRpb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uYXVkaW9Db2RlYywgdmlkZW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWMsIHNiO1xuICAgICAgLy9sb2dnZXIubG9nKCdwbGF5bGlzdCBsZXZlbCBBL1YgY29kZWNzOicgKyBhdWRpb0NvZGVjICsgJywnICsgdmlkZW9Db2RlYyk7XG4gICAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGNvZGVjczonICsgY29kZWMpO1xuICAgICAgLy8gaWYgcGxheWxpc3QgZG9lcyBub3Qgc3BlY2lmeSBjb2RlY3MsIHVzZSBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudFxuICAgICAgaWYgKGF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCB8fCBkYXRhLmF1ZGlvY29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgfVxuICAgICAgaWYgKHZpZGVvQ29kZWMgPT09IHVuZGVmaW5lZCB8fCBkYXRhLnZpZGVvY29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB2aWRlb0NvZGVjID0gZGF0YS52aWRlb0NvZGVjO1xuICAgICAgfVxuICAgICAgLy8gaW4gY2FzZSBzZXZlcmFsIGF1ZGlvIGNvZGVjcyBtaWdodCBiZSB1c2VkLCBmb3JjZSBIRS1BQUMgZm9yIGF1ZGlvIChzb21lIGJyb3dzZXJzIGRvbid0IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoKVxuICAgICAgLy9kb24ndCBkbyBpdCBmb3IgbW9ubyBzdHJlYW1zIC4uLlxuICAgICAgaWYgKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCAmJiBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID09PSAyICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhbmRyb2lkJykgPT09IC0xICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSB7fTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgc2VsZWN0ZWQgQS9WIGNvZGVjcyBmb3Igc291cmNlQnVmZmVyczoke2F1ZGlvQ29kZWN9LCR7dmlkZW9Db2RlY31gKTtcbiAgICAgICAgLy8gY3JlYXRlIHNvdXJjZSBCdWZmZXIgYW5kIGxpbmsgdGhlbSB0byBNZWRpYVNvdXJjZVxuICAgICAgICBpZiAoYXVkaW9Db2RlYykge1xuICAgICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8gPSB0aGlzLm1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcihgdmlkZW8vbXA0O2NvZGVjcz0ke2F1ZGlvQ29kZWN9YCk7XG4gICAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZpZGVvQ29kZWMpIHtcbiAgICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLnZpZGVvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHt2aWRlb0NvZGVjfWApO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoYXVkaW9Db2RlYykge1xuICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goe3R5cGU6ICdhdWRpbycsIGRhdGE6IGRhdGEuYXVkaW9Nb292fSk7XG4gICAgICB9XG4gICAgICBpZih2aWRlb0NvZGVjKSB7XG4gICAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7dHlwZTogJ3ZpZGVvJywgZGF0YTogZGF0YS52aWRlb01vb3Z9KTtcbiAgICAgIH1cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnbWVudFBhcnNpbmcoZXZlbnQsIGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gdGhpcy5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnRwYXJzZTIgPSBEYXRlLm5vdygpO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgICBpZiAobGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICAgIHZhciBmcmFnbWVudHMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5kZXRhaWxzLmZyYWdtZW50cztcbiAgICAgICAgdmFyIHNuMCA9IGZyYWdtZW50c1swXS5zbiwgc24xID0gZnJhZ21lbnRzW2ZyYWdtZW50cy5sZW5ndGggLSAxXS5zbiwgc24gPSB0aGlzLmZyYWcuc247XG4gICAgICAgIC8vcmV0cmlldmUgdGhpcy5mcmFnLnNuIGluIHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdXG4gICAgICAgIGlmIChzbiA+PSBzbjAgJiYgc24gPD0gc24xKSB7XG4gICAgICAgICAgbGV2ZWwuZGV0YWlscy5zbGlkaW5nID0gZGF0YS5zdGFydFBUUyAtIGZyYWdtZW50c1tzbiAtIHNuMF0uc3RhcnQ7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IHNsaWRpbmc6JHtsZXZlbC5kZXRhaWxzLnNsaWRpbmcudG9GaXhlZCgzKX0nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGRhdGEsIHR5cGUvc3RhcnRQVFMvZW5kUFRTL3N0YXJ0RFRTL2VuZERUUy9uYjoke2RhdGEudHlwZX0vJHtkYXRhLnN0YXJ0UFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5lbmRQVFMudG9GaXhlZCgzKX0vJHtkYXRhLnN0YXJ0RFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5lbmREVFMudG9GaXhlZCgzKX0vJHtkYXRhLm5ifWApO1xuICAgICAgLy90aGlzLmZyYWcuZHJpZnQ9ZGF0YS5zdGFydFBUUy10aGlzLmZyYWcuc3RhcnQ7XG4gICAgICB0aGlzLmZyYWcuZHJpZnQgPSAwO1xuICAgICAgLy8gaWYobGV2ZWwuZGV0YWlscy5zbGlkaW5nKSB7XG4gICAgICAvLyAgIHRoaXMuZnJhZy5kcmlmdC09bGV2ZWwuZGV0YWlscy5zbGlkaW5nO1xuICAgICAgLy8gfVxuICAgICAgLy9sb2dnZXIubG9nKCcgICAgICBkcmlmdDoke3RoaXMuZnJhZy5kcmlmdC50b0ZpeGVkKDMpfScpO1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHt0eXBlOiBkYXRhLnR5cGUsIGRhdGE6IGRhdGEubW9vZn0pO1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHt0eXBlOiBkYXRhLnR5cGUsIGRhdGE6IGRhdGEubWRhdH0pO1xuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gZGF0YS5lbmRQVFM7XG4gICAgICB0aGlzLmJ1ZmZlclJhbmdlLnB1c2goe3R5cGU6IGRhdGEudHlwZSwgc3RhcnQ6IGRhdGEuc3RhcnRQVFMsIGVuZDogZGF0YS5lbmRQVFMsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICAgICAgLy8gaWYoZGF0YS50eXBlID09PSAndmlkZW8nKSB7XG4gICAgICAvLyAgIHRoaXMuZnJhZy5mcHNFeHBlY3RlZCA9IChkYXRhLm5iLTEpIC8gKGRhdGEuZW5kUFRTIC0gZGF0YS5zdGFydFBUUyk7XG4gICAgICAvLyB9XG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2Fybihgbm90IGluIFBBUlNJTkcgc3RhdGUsIGRpc2NhcmRpbmcgJHtldmVudH1gKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdtZW50UGFyc2VkKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSB0aGlzLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLlBBUlNFRDtcbiAgICAgIHRoaXMuc3RhdHMudHBhcnNlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRXJyb3IoZXZlbnQsIGRhdGEpIHtcbiAgICBzd2l0Y2goZGF0YS5kZXRhaWxzKSB7XG4gICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIG9uIGVycm9yc1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ6XG4gICAgICAgIC8vIGlmIGZhdGFsIGVycm9yLCBzdG9wIHByb2Nlc3NpbmcsIG90aGVyd2lzZSBtb3ZlIHRvIElETEUgdG8gcmV0cnkgbG9hZGluZ1xuICAgICAgICBsb2dnZXIud2FybihgYnVmZmVyIGNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSB3aGlsZSBsb2FkaW5nIGZyYWcsc3dpdGNoIHRvICR7ZGF0YS5mYXRhbCA/ICdFUlJPUicgOiAnSURMRSd9IHN0YXRlIC4uLmApO1xuICAgICAgICB0aGlzLnN0YXRlID0gZGF0YS5mYXRhbCA/IHRoaXMuRVJST1IgOiB0aGlzLklETEU7XG4gICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgb25Tb3VyY2VCdWZmZXJVcGRhdGVFbmQoKSB7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IHRoaXMuQVBQRU5ESU5HICYmIHRoaXMubXA0c2VnbWVudHMubGVuZ3RoID09PSAwKSAge1xuICAgICAgaWYgKHRoaXMuZnJhZykge1xuICAgICAgICB0aGlzLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiB0aGlzLnN0YXRzLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgdmlkZW8gYnVmZmVyZWQgOiAke3RoaXMudGltZVJhbmdlc1RvU3RyaW5nKHRoaXMudmlkZW8uYnVmZmVyZWQpfWApO1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uU291cmNlQnVmZmVyRXJyb3IoZXZlbnQpIHtcbiAgICBsb2dnZXIuZXJyb3IoYHNvdXJjZUJ1ZmZlciBlcnJvcjoke2V2ZW50fWApO1xuICAgIHRoaXMuc3RhdGUgPSB0aGlzLkVSUk9SO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19BUFBFTkRJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIHRpbWVSYW5nZXNUb1N0cmluZyhyKSB7XG4gICAgdmFyIGxvZyA9ICcnLCBsZW4gPSByLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKyspIHtcbiAgICAgIGxvZyArPSAnWycgKyByLnN0YXJ0KGkpICsgJywnICsgci5lbmQoaSkgKyAnXSc7XG4gICAgfVxuICAgIHJldHVybiBsb2c7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckNvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBMZXZlbCBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciBmcm9tICcuLi9vYnNlcnZlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBMZXZlbENvbnRyb2xsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25tbCA9IHRoaXMub25NYW5pZmVzdExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbHAgPSB0aGlzLm9uRnJhZ21lbnRMb2FkUHJvZ3Jlc3MuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZXJyID0gdGhpcy5vbkVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FEX1BST0dSRVNTLCB0aGlzLm9uZmxwKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRVJST1IsIHRoaXMub25lcnIpO1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB0aGlzLm9ubWwpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHRoaXMub25mbHApO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIH1cbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IC0xO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRlZChldmVudCwgZGF0YSkge1xuICAgIHZhciBsZXZlbHMgPSBbXSwgYml0cmF0ZVN0YXJ0LCBpLCBiaXRyYXRlU2V0ID0ge307XG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICB2YXIgcmVkdW5kYW50TGV2ZWxJZCA9IGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV07XG4gICAgICBpZiAocmVkdW5kYW50TGV2ZWxJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSBsZXZlbHMubGVuZ3RoO1xuICAgICAgICBsZXZlbC51cmwgPSBbbGV2ZWwudXJsXTtcbiAgICAgICAgbGV2ZWwudXJsSWQgPSAwO1xuICAgICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHNbcmVkdW5kYW50TGV2ZWxJZF0udXJsLnB1c2gobGV2ZWwudXJsKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBzdGFydCBiaXRyYXRlIGlzIHRoZSBmaXJzdCBiaXRyYXRlIG9mIHRoZSBtYW5pZmVzdFxuICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgIC8vIHNvcnQgbGV2ZWwgb24gYml0cmF0ZVxuICAgIGxldmVscy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYS5iaXRyYXRlIC0gYi5iaXRyYXRlO1xuICAgIH0pO1xuICAgIHRoaXMuX2xldmVscyA9IGxldmVscztcbiAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAobGV2ZWxzW2ldLmJpdHJhdGUgPT09IGJpdHJhdGVTdGFydCkge1xuICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgbWFuaWZlc3QgbG9hZGVkLCR7bGV2ZWxzLmxlbmd0aH0gbGV2ZWwocykgZm91bmQsIGZpcnN0IGJpdHJhdGU6JHtiaXRyYXRlU3RhcnR9YCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwge2xldmVsczogdGhpcy5fbGV2ZWxzLCBmaXJzdExldmVsOiB0aGlzLl9maXJzdExldmVsLCBzdGF0czogZGF0YS5zdGF0c30pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVscztcbiAgfVxuXG4gIGdldCBsZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWw7XG4gIH1cblxuICBzZXQgbGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBpZiAodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsIHx8IHRoaXMuX2xldmVsc1tuZXdMZXZlbF0uZGV0YWlscyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpO1xuICAgIH1cbiAgfVxuXG4gc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCkge1xuICAgIC8vIGNoZWNrIGlmIGxldmVsIGlkeCBpcyB2YWxpZFxuICAgIGlmIChuZXdMZXZlbCA+PSAwICYmIG5ld0xldmVsIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICB9XG4gICAgICB0aGlzLl9sZXZlbCA9IG5ld0xldmVsO1xuICAgICAgbG9nZ2VyLmxvZyhgc3dpdGNoaW5nIHRvIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX1NXSVRDSCwge2xldmVsOiBuZXdMZXZlbH0pO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW25ld0xldmVsXTtcbiAgICAgICAvLyBjaGVjayBpZiB3ZSBuZWVkIHRvIGxvYWQgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWxcbiAgICAgIGlmIChsZXZlbC5kZXRhaWxzID09PSB1bmRlZmluZWQgfHwgbGV2ZWwuZGV0YWlscy5saXZlID09PSB0cnVlKSB7XG4gICAgICAgIC8vIGxldmVsIG5vdCByZXRyaWV2ZWQgeWV0LCBvciBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gKHJlKWxvYWQgaXRcbiAgICAgICAgbG9nZ2VyLmxvZyhgKHJlKWxvYWRpbmcgcGxheWxpc3QgZm9yIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICAgIHZhciB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHt1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsOiBuZXdMZXZlbCwgaWQ6IHVybElkfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGludmFsaWQgbGV2ZWwgaWQgZ2l2ZW4sIHRyaWdnZXIgZXJyb3JcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5PVEhFUl9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkxFVkVMX1NXSVRDSF9FUlJPUiwgbGV2ZWw6IG5ld0xldmVsLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ2ludmFsaWQgbGV2ZWwgaWR4J30pO1xuICAgIH1cbiB9XG5cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgfVxuXG4gIHNldCBtYW51YWxMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgaWYgKG5ld0xldmVsICE9PSAtMSkge1xuICAgICAgdGhpcy5sZXZlbCA9IG5ld0xldmVsO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gIH1cblxuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIGlmICh0aGlzLl9zdGFydExldmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhcnRMZXZlbDtcbiAgICB9XG4gIH1cblxuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX3N0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkUHJvZ3Jlc3MoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgIGlmIChzdGF0cy5hYm9ydGVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubGFzdGZldGNoZHVyYXRpb24gPSAobmV3IERhdGUoKSAtIHN0YXRzLnRyZXF1ZXN0KSAvIDEwMDA7XG4gICAgICB0aGlzLmxhc3RmZXRjaGxldmVsID0gZGF0YS5mcmFnLmxldmVsO1xuICAgICAgdGhpcy5sYXN0YncgPSAoc3RhdHMubG9hZGVkICogOCkgLyB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uO1xuICAgICAgLy9jb25zb2xlLmxvZygnZmV0Y2hEdXJhdGlvbjoke3RoaXMubGFzdGZldGNoZHVyYXRpb259LGJ3OiR7KHRoaXMubGFzdGJ3LzEwMDApLnRvRml4ZWQoMCl9LyR7c3RhdHMuYWJvcnRlZH0nKTtcbiAgICB9XG4gIH1cblxuICBvbkVycm9yKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGRldGFpbHMgPSBkYXRhLmRldGFpbHMsIGxldmVsSWQsIGxldmVsO1xuICAgIC8vIHRyeSB0byByZWNvdmVyIG5vdCBmYXRhbCBlcnJvcnNcbiAgICBzd2l0Y2goZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUjpcbiAgICAgICAgIGxldmVsSWQgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGxldmVsSWQgPSBkYXRhLmxldmVsO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvKiB0cnkgdG8gc3dpdGNoIHRvIGEgcmVkdW5kYW50IHN0cmVhbSBpZiBhbnkgYXZhaWxhYmxlLlxuICAgICAqIGlmIG5vIHJlZHVuZGFudCBzdHJlYW0gYXZhaWxhYmxlLCBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gKGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgMClcbiAgICAgKiBvdGhlcndpc2UsIHdlIGNhbm5vdCByZWNvdmVyIHRoaXMgbmV0d29yayBlcnJvciAuLi4uXG4gICAgICovXG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF07XG4gICAgICBpZiAobGV2ZWwudXJsSWQgPCAobGV2ZWwudXJsLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgIGxldmVsLnVybElkKys7XG4gICAgICAgIGxldmVsLmRldGFpbHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gZm9yIGxldmVsICR7bGV2ZWxJZH06IHN3aXRjaGluZyB0byByZWR1bmRhbnQgc3RyZWFtIGlkICR7bGV2ZWwudXJsSWR9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBjb3VsZCB0cnkgdG8gcmVjb3ZlciBpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IGxvd2VzdCBsZXZlbCAoMClcbiAgICAgICAgbGV0IHJlY292ZXJhYmxlID0gKCh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpICYmIGxldmVsSWQpO1xuICAgICAgICBpZiAocmVjb3ZlcmFibGUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9OiBlbWVyZ2VuY3kgc3dpdGNoLWRvd24gZm9yIG5leHQgZnJhZ21lbnRgKTtcbiAgICAgICAgICB0aGlzLmxhc3RidyA9IDA7XG4gICAgICAgICAgdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbiA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBjYW5ub3QgcmVjb3ZlciAke2RldGFpbHN9IGVycm9yYCk7XG4gICAgICAgICAgdGhpcy5fbGV2ZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgICAgICAgIC8vIHJlZGlzcGF0Y2ggc2FtZSBlcnJvciBidXQgd2l0aCBmYXRhbCBzZXQgdG8gdHJ1ZVxuICAgICAgICAgICAgZGF0YS5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKGV2ZW50LCBkYXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGV2ZW50LCBkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY3VycmVudCBwbGF5bGlzdCBpcyBhIGxpdmUgcGxheWxpc3RcbiAgICBpZiAoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwICogZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHZhciBsZXZlbElkID0gdGhpcy5fbGV2ZWw7XG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdLCB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbGV2ZWxJZCwgaWQ6IHVybElkfSk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExvYWRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fbWFudWFsTGV2ZWwgIT09IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgcmV0dXJuIHRoaXMubmV4dEF1dG9MZXZlbCgpO1xuICAgIH1cbiAgfVxuXG4gIG5leHRBdXRvTGV2ZWwoKSB7XG4gICAgdmFyIGxhc3RidyA9IHRoaXMubGFzdGJ3LCBhZGp1c3RlZGJ3LCBpLCBtYXhBdXRvTGV2ZWw7XG4gICAgaWYgKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9sZXZlbHMubGVuZ3RoIC0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWF4QXV0b0xldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgICB9XG4gICAgLy8gZm9sbG93IGFsZ29yaXRobSBjYXB0dXJlZCBmcm9tIHN0YWdlZnJpZ2h0IDpcbiAgICAvLyBodHRwczovL2FuZHJvaWQuZ29vZ2xlc291cmNlLmNvbS9wbGF0Zm9ybS9mcmFtZXdvcmtzL2F2LysvbWFzdGVyL21lZGlhL2xpYnN0YWdlZnJpZ2h0L2h0dHBsaXZlL0xpdmVTZXNzaW9uLmNwcFxuICAgIC8vIFBpY2sgdGhlIGhpZ2hlc3QgYmFuZHdpZHRoIHN0cmVhbSBiZWxvdyBvciBlcXVhbCB0byBlc3RpbWF0ZWQgYmFuZHdpZHRoLlxuICAgIGZvciAoaSA9IDA7IGkgPD0gbWF4QXV0b0xldmVsOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmIChpIDw9IHRoaXMuX2xldmVsKSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjggKiBsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43ICogbGFzdGJ3O1xuICAgICAgfVxuICAgICAgaWYgKGFkanVzdGVkYncgPCB0aGlzLl9sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCwgaSAtIDEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaSAtIDE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxDb250cm9sbGVyO1xuXG4iLCJpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBUU0RlbXV4ZXIgZnJvbSAnLi90c2RlbXV4ZXInO1xuaW1wb3J0IFRTRGVtdXhlcldvcmtlciBmcm9tICcuL3RzZGVtdXhlcndvcmtlcic7XG5pbXBvcnQgb2JzZXJ2ZXIgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIERlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmIChjb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ1RTIGRlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoVFNEZW11eGVyV29ya2VyKTtcbiAgICAgICAgICB0aGlzLm9ud21zZyA9IHRoaXMub25Xb3JrZXJNZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgICAgICAgdGhpcy53LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdpbml0J30pO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcignZXJyb3Igd2hpbGUgaW5pdGlhbGl6aW5nIFRTRGVtdXhlcldvcmtlciwgZmFsbGJhY2sgb24gcmVndWxhciBUU0RlbXV4ZXInKTtcbiAgICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLncpIHtcbiAgICAgIHRoaXMudy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgZHVyYXRpb24pIHtcbiAgICBpZiAodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2Uoe2NtZDogJ2RlbXV4JywgZGF0YTogZGF0YSwgYXVkaW9Db2RlYzogYXVkaW9Db2RlYywgdmlkZW9Db2RlYzogdmlkZW9Db2RlYywgdGltZU9mZnNldDogdGltZU9mZnNldCwgY2M6IGNjLCBsZXZlbDogbGV2ZWwsIGR1cmF0aW9uOiBkdXJhdGlvbn0sIFtkYXRhXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEpLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIGR1cmF0aW9uKTtcbiAgICAgIHRoaXMuZGVtdXhlci5lbmQoKTtcbiAgICB9XG4gIH1cblxuICBvbldvcmtlck1lc3NhZ2UoZXYpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdvbldvcmtlck1lc3NhZ2U6JyArIGV2LmRhdGEuZXZlbnQpO1xuICAgIHN3aXRjaChldi5kYXRhLmV2ZW50KSB7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQ6XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgaWYgKGV2LmRhdGEuYXVkaW9Nb292KSB7XG4gICAgICAgICAgb2JqLmF1ZGlvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEuYXVkaW9Nb292KTtcbiAgICAgICAgICBvYmouYXVkaW9Db2RlYyA9IGV2LmRhdGEuYXVkaW9Db2RlYztcbiAgICAgICAgICBvYmouYXVkaW9DaGFubmVsQ291bnQgPSBldi5kYXRhLmF1ZGlvQ2hhbm5lbENvdW50O1xuICAgICAgICB9XG4gICAgICAgIGlmIChldi5kYXRhLnZpZGVvTW9vdikge1xuICAgICAgICAgIG9iai52aWRlb01vb3YgPSBuZXcgVWludDhBcnJheShldi5kYXRhLnZpZGVvTW9vdik7XG4gICAgICAgICAgb2JqLnZpZGVvQ29kZWMgPSBldi5kYXRhLnZpZGVvQ29kZWM7XG4gICAgICAgICAgb2JqLnZpZGVvV2lkdGggPSBldi5kYXRhLnZpZGVvV2lkdGg7XG4gICAgICAgICAgb2JqLnZpZGVvSGVpZ2h0ID0gZXYuZGF0YS52aWRlb0hlaWdodDtcbiAgICAgICAgfVxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIG9iaik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfREFUQTpcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICAgICAgbW9vZjogbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5tb29mKSxcbiAgICAgICAgICBtZGF0OiBuZXcgVWludDhBcnJheShldi5kYXRhLm1kYXQpLFxuICAgICAgICAgIHN0YXJ0UFRTOiBldi5kYXRhLnN0YXJ0UFRTLFxuICAgICAgICAgIGVuZFBUUzogZXYuZGF0YS5lbmRQVFMsXG4gICAgICAgICAgc3RhcnREVFM6IGV2LmRhdGEuc3RhcnREVFMsXG4gICAgICAgICAgZW5kRFRTOiBldi5kYXRhLmVuZERUUyxcbiAgICAgICAgICB0eXBlOiBldi5kYXRhLnR5cGUsXG4gICAgICAgICAgbmI6IGV2LmRhdGEubmJcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihldi5kYXRhLmV2ZW50LCBldi5kYXRhLmRhdGEpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcjtcblxuIiwiLyoqXG4gKiBQYXJzZXIgZm9yIGV4cG9uZW50aWFsIEdvbG9tYiBjb2RlcywgYSB2YXJpYWJsZS1iaXR3aWR0aCBudW1iZXIgZW5jb2Rpbmcgc2NoZW1lIHVzZWQgYnkgaDI2NC5cbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBFeHBHb2xvbWIge1xuXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIC8vIHRoZSBudW1iZXIgb2YgYnl0ZXMgbGVmdCB0byBleGFtaW5lIGluIHRoaXMuZGF0YVxuICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAvLyB0aGUgY3VycmVudCB3b3JkIGJlaW5nIGV4YW1pbmVkXG4gICAgdGhpcy53b3JkID0gMDsgLy8gOnVpbnRcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJpdHMgbGVmdCB0byBleGFtaW5lIGluIHRoZSBjdXJyZW50IHdvcmRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSAwOyAvLyA6dWludFxuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBsb2FkV29yZCgpIHtcbiAgICB2YXJcbiAgICAgIHBvc2l0aW9uID0gdGhpcy5kYXRhLmJ5dGVMZW5ndGggLSB0aGlzLmJ5dGVzQXZhaWxhYmxlLFxuICAgICAgd29ya2luZ0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCksXG4gICAgICBhdmFpbGFibGVCeXRlcyA9IE1hdGgubWluKDQsIHRoaXMuYnl0ZXNBdmFpbGFibGUpO1xuICAgIGlmIChhdmFpbGFibGVCeXRlcyA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdubyBieXRlcyBhdmFpbGFibGUnKTtcbiAgICB9XG4gICAgd29ya2luZ0J5dGVzLnNldCh0aGlzLmRhdGEuc3ViYXJyYXkocG9zaXRpb24sIHBvc2l0aW9uICsgYXZhaWxhYmxlQnl0ZXMpKTtcbiAgICB0aGlzLndvcmQgPSBuZXcgRGF0YVZpZXcod29ya2luZ0J5dGVzLmJ1ZmZlcikuZ2V0VWludDMyKDApO1xuICAgIC8vIHRyYWNrIHRoZSBhbW91bnQgb2YgdGhpcy5kYXRhIHRoYXQgaGFzIGJlZW4gcHJvY2Vzc2VkXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlID0gYXZhaWxhYmxlQnl0ZXMgKiA4O1xuICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gYXZhaWxhYmxlQnl0ZXM7XG4gIH1cblxuICAvLyAoY291bnQ6aW50KTp2b2lkXG4gIHNraXBCaXRzKGNvdW50KSB7XG4gICAgdmFyIHNraXBCeXRlczsgLy8gOmludFxuICAgIGlmICh0aGlzLmJpdHNBdmFpbGFibGUgPiBjb3VudCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9IGVsc2Uge1xuICAgICAgY291bnQgLT0gdGhpcy5iaXRzQXZhaWxhYmxlO1xuICAgICAgc2tpcEJ5dGVzID0gY291bnQgPj4gMztcbiAgICAgIGNvdW50IC09IChza2lwQnl0ZXMgPj4gMyk7XG4gICAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlIC09IHNraXBCeXRlcztcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICAgIHRoaXMud29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfVxuICB9XG5cbiAgLy8gKHNpemU6aW50KTp1aW50XG4gIHJlYWRCaXRzKHNpemUpIHtcbiAgICB2YXJcbiAgICAgIGJpdHMgPSBNYXRoLm1pbih0aGlzLmJpdHNBdmFpbGFibGUsIHNpemUpLCAvLyA6dWludFxuICAgICAgdmFsdSA9IHRoaXMud29yZCA+Pj4gKDMyIC0gYml0cyk7IC8vIDp1aW50XG4gICAgaWYgKHNpemUgPiAzMikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDYW5ub3QgcmVhZCBtb3JlIHRoYW4gMzIgYml0cyBhdCBhIHRpbWUnKTtcbiAgICB9XG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGJpdHM7XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMud29yZCA8PD0gYml0cztcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnl0ZXNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgfVxuICAgIGJpdHMgPSBzaXplIC0gYml0cztcbiAgICBpZiAoYml0cyA+IDApIHtcbiAgICAgIHJldHVybiB2YWx1IDw8IGJpdHMgfCB0aGlzLnJlYWRCaXRzKGJpdHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdmFsdTtcbiAgICB9XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHNraXBMWigpIHtcbiAgICB2YXIgbGVhZGluZ1plcm9Db3VudDsgLy8gOnVpbnRcbiAgICBmb3IgKGxlYWRpbmdaZXJvQ291bnQgPSAwOyBsZWFkaW5nWmVyb0NvdW50IDwgdGhpcy5iaXRzQXZhaWxhYmxlOyArK2xlYWRpbmdaZXJvQ291bnQpIHtcbiAgICAgIGlmICgwICE9PSAodGhpcy53b3JkICYgKDB4ODAwMDAwMDAgPj4+IGxlYWRpbmdaZXJvQ291bnQpKSkge1xuICAgICAgICAvLyB0aGUgZmlyc3QgYml0IG9mIHdvcmtpbmcgd29yZCBpcyAxXG4gICAgICAgIHRoaXMud29yZCA8PD0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgfVxuICAgIH1cbiAgICAvLyB3ZSBleGhhdXN0ZWQgd29yZCBhbmQgc3RpbGwgaGF2ZSBub3QgZm91bmQgYSAxXG4gICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50ICsgdGhpcy5za2lwTFooKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcFVFRygpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMWigpKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcEVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dWludFxuICByZWFkVUVHKCkge1xuICAgIHZhciBjbHogPSB0aGlzLnNraXBMWigpOyAvLyA6dWludFxuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKGNseiArIDEpIC0gMTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkRUcoKSB7XG4gICAgdmFyIHZhbHUgPSB0aGlzLnJlYWRVRUcoKTsgLy8gOmludFxuICAgIGlmICgweDAxICYgdmFsdSkge1xuICAgICAgLy8gdGhlIG51bWJlciBpcyBvZGQgaWYgdGhlIGxvdyBvcmRlciBiaXQgaXMgc2V0XG4gICAgICByZXR1cm4gKDEgKyB2YWx1KSA+Pj4gMTsgLy8gYWRkIDEgdG8gbWFrZSBpdCBldmVuLCBhbmQgZGl2aWRlIGJ5IDJcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xICogKHZhbHUgPj4+IDEpOyAvLyBkaXZpZGUgYnkgdHdvIHRoZW4gbWFrZSBpdCBuZWdhdGl2ZVxuICAgIH1cbiAgfVxuXG4gIC8vIFNvbWUgY29udmVuaWVuY2UgZnVuY3Rpb25zXG4gIC8vIDpCb29sZWFuXG4gIHJlYWRCb29sZWFuKCkge1xuICAgIHJldHVybiAxID09PSB0aGlzLnJlYWRCaXRzKDEpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVQnl0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyg4KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBFeHBHb2xvbWIgZGVjb2RlciBwYXN0IGEgc2NhbGluZyBsaXN0LiBUaGUgc2NhbGluZ1xuICAgKiBsaXN0IGlzIG9wdGlvbmFsbHkgdHJhbnNtaXR0ZWQgYXMgcGFydCBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlclxuICAgKiBzZXQgYW5kIGlzIG5vdCByZWxldmFudCB0byB0cmFuc211eGluZy5cbiAgICogQHBhcmFtIGNvdW50IHtudW1iZXJ9IHRoZSBudW1iZXIgb2YgZW50cmllcyBpbiB0aGlzIHNjYWxpbmcgbGlzdFxuICAgKiBAc2VlIFJlY29tbWVuZGF0aW9uIElUVS1UIEguMjY0LCBTZWN0aW9uIDcuMy4yLjEuMS4xXG4gICAqL1xuICBza2lwU2NhbGluZ0xpc3QoY291bnQpIHtcbiAgICB2YXJcbiAgICAgIGxhc3RTY2FsZSA9IDgsXG4gICAgICBuZXh0U2NhbGUgPSA4LFxuICAgICAgaixcbiAgICAgIGRlbHRhU2NhbGU7XG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEVHKCk7XG4gICAgICAgIG5leHRTY2FsZSA9IChsYXN0U2NhbGUgKyBkZWx0YVNjYWxlICsgMjU2KSAlIDI1NjtcbiAgICAgIH1cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNQUygpIHtcbiAgICB2YXJcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IDAsXG4gICAgICBwcm9maWxlSWRjLHByb2ZpbGVDb21wYXQsbGV2ZWxJZGMsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuICAgIHRoaXMucmVhZFVCeXRlKCk7XG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vIHByb2ZpbGVfaWRjXG4gICAgcHJvZmlsZUNvbXBhdCA9IHRoaXMucmVhZEJpdHMoNSk7IC8vIGNvbnN0cmFpbnRfc2V0WzAtNF1fZmxhZywgdSg1KVxuICAgIHRoaXMuc2tpcEJpdHMoMyk7IC8vIHJlc2VydmVkX3plcm9fM2JpdHMgdSgzKSxcbiAgICBsZXZlbElkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vbGV2ZWxfaWRjIHUoOClcbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gc2VxX3BhcmFtZXRlcl9zZXRfaWRcbiAgICAvLyBzb21lIHByb2ZpbGVzIGhhdmUgbW9yZSBvcHRpb25hbCBkYXRhIHdlIGRvbid0IG5lZWRcbiAgICBpZiAocHJvZmlsZUlkYyA9PT0gMTAwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjIgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTQ0KSB7XG4gICAgICB2YXIgY2hyb21hRm9ybWF0SWRjID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2x1bWFfbWludXM4XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2Nocm9tYV9taW51czhcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHFwcHJpbWVfeV96ZXJvX3RyYW5zZm9ybV9ieXBhc3NfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19tYXRyaXhfcHJlc2VudF9mbGFnXG4gICAgICAgIHNjYWxpbmdMaXN0Q291bnQgPSAoY2hyb21hRm9ybWF0SWRjICE9PSAzKSA/IDggOiAxMjtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNjYWxpbmdMaXN0Q291bnQ7IGkrKykge1xuICAgICAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbGlzdF9wcmVzZW50X2ZsYWdbIGkgXVxuICAgICAgICAgICAgaWYgKGkgPCA2KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDE2KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIGxvZzJfbWF4X2ZyYW1lX251bV9taW51czRcbiAgICB2YXIgcGljT3JkZXJDbnRUeXBlID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMCkge1xuICAgICAgdGhpcy5yZWFkVUVHKCk7IC8vbG9nMl9tYXhfcGljX29yZGVyX2NudF9sc2JfbWludXM0XG4gICAgfSBlbHNlIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDEpIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRlbHRhX3BpY19vcmRlcl9hbHdheXNfemVyb19mbGFnXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX25vbl9yZWZfcGljXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3RvcF90b19ib3R0b21fZmllbGRcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlOyBpKyspIHtcbiAgICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9yZWZfZnJhbWVbIGkgXVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbWF4X251bV9yZWZfZnJhbWVzXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZ2Fwc19pbl9mcmFtZV9udW1fdmFsdWVfYWxsb3dlZF9mbGFnXG4gICAgcGljV2lkdGhJbk1ic01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBmcmFtZU1ic09ubHlGbGFnID0gdGhpcy5yZWFkQml0cygxKTtcbiAgICBpZiAoZnJhbWVNYnNPbmx5RmxhZyA9PT0gMCkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gbWJfYWRhcHRpdmVfZnJhbWVfZmllbGRfZmxhZ1xuICAgIH1cbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkaXJlY3RfOHg4X2luZmVyZW5jZV9mbGFnXG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBmcmFtZV9jcm9wcGluZ19mbGFnXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb2ZpbGVJZGMgOiBwcm9maWxlSWRjLFxuICAgICAgcHJvZmlsZUNvbXBhdCA6IHByb2ZpbGVDb21wYXQsXG4gICAgICBsZXZlbElkYyA6IGxldmVsSWRjLFxuICAgICAgd2lkdGg6ICgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIsXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtIChmcmFtZUNyb3BUb3BPZmZzZXQgKiAyKSAtIChmcmFtZUNyb3BCb3R0b21PZmZzZXQgKiAyKVxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhwR29sb21iO1xuIiwiLyoqXG4gKiBBIHN0cmVhbS1iYXNlZCBtcDJ0cyB0byBtcDQgY29udmVydGVyLiBUaGlzIHV0aWxpdHkgaXMgdXNlZCB0b1xuICogZGVsaXZlciBtcDRzIHRvIGEgU291cmNlQnVmZmVyIG9uIHBsYXRmb3JtcyB0aGF0IHN1cHBvcnQgbmF0aXZlXG4gKiBNZWRpYSBTb3VyY2UgRXh0ZW5zaW9ucy5cbiovXG5cbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXhwR29sb21iIGZyb20gJy4vZXhwLWdvbG9tYic7XG4vLyBpbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG4gaW1wb3J0IE1QNCBmcm9tICcuLi9yZW11eC9tcDQtZ2VuZXJhdG9yJztcbiBpbXBvcnQgb2JzZXJ2ZXIgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgVFNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmxhc3RDQyA9IDA7XG4gICAgdGhpcy5QRVNfVElNRVNDQUxFID0gOTAwMDA7XG4gICAgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IgPSA0O1xuICAgIHRoaXMuTVA0X1RJTUVTQ0FMRSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSAvIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SO1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5wbXRQYXJzZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9wbXRJZCA9IHRoaXMuX2F2Y0lkID0gdGhpcy5fYWFjSWQgPSAtMTtcbiAgICB0aGlzLl9hdmNUcmFjayA9IHt0eXBlOiAndmlkZW8nLCBzZXF1ZW5jZU51bWJlcjogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7dHlwZTogJ2F1ZGlvJywgc2VxdWVuY2VOdW1iZXI6IDB9O1xuICAgIHRoaXMuX2F2Y1NhbXBsZXMgPSBbXTtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1ID0gMDtcbiAgICB0aGlzLl9hYWNTYW1wbGVzID0gW107XG4gICAgdGhpcy5fYWFjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBkdXJhdGlvbikge1xuICAgIHZhciBhdmNEYXRhLCBhYWNEYXRhLCBzdGFydCwgbGVuID0gZGF0YS5sZW5ndGgsIHN0dCwgcGlkLCBhdGYsIG9mZnNldDtcbiAgICB0aGlzLmF1ZGlvQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgIHRoaXMudmlkZW9Db2RlYyA9IHZpZGVvQ29kZWM7XG4gICAgdGhpcy50aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgIGlmIChjYyAhPT0gdGhpcy5sYXN0Q0MpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2Rpc2NvbnRpbnVpdHkgZGV0ZWN0ZWQnKTtcbiAgICAgIHRoaXMuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICAgICAgdGhpcy5sYXN0Q0MgPSBjYztcbiAgICB9IGVsc2UgaWYgKGxldmVsICE9PSB0aGlzLmxhc3RMZXZlbCkge1xuICAgICAgbG9nZ2VyLmxvZygnbGV2ZWwgc3dpdGNoIGRldGVjdGVkJyk7XG4gICAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgICB0aGlzLmxhc3RMZXZlbCA9IGxldmVsO1xuICAgIH1cbiAgICB2YXIgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQsIGF2Y0lkID0gdGhpcy5fYXZjSWQsIGFhY0lkID0gdGhpcy5fYWFjSWQ7XG4gICAgLy8gbG9vcCB0aHJvdWdoIFRTIHBhY2tldHNcbiAgICBmb3IgKHN0YXJ0ID0gMDsgc3RhcnQgPCBsZW47IHN0YXJ0ICs9IDE4OCkge1xuICAgICAgaWYgKGRhdGFbc3RhcnRdID09PSAweDQ3KSB7XG4gICAgICAgIHN0dCA9ICEhKGRhdGFbc3RhcnQgKyAxXSAmIDB4NDApO1xuICAgICAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIFRTWzFdXG4gICAgICAgIHBpZCA9ICgoZGF0YVtzdGFydCArIDFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0ICsgMl07XG4gICAgICAgIGF0ZiA9IChkYXRhW3N0YXJ0ICsgM10gJiAweDMwKSA+PiA0O1xuICAgICAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGUgZmlmdGggYnl0ZSBvZiB0aGUgVFMgcGFja2V0IGhlYWRlci5cbiAgICAgICAgaWYgKGF0ZiA+IDEpIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCArIDUgKyBkYXRhW3N0YXJ0ICsgNF07XG4gICAgICAgICAgLy8gY29udGludWUgaWYgdGhlcmUgaXMgb25seSBhZGFwdGF0aW9uIGZpZWxkXG4gICAgICAgICAgaWYgKG9mZnNldCA9PT0gKHN0YXJ0ICsgMTg4KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocG10UGFyc2VkKSB7XG4gICAgICAgICAgaWYgKHBpZCA9PT0gYXZjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYXZjRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgICAgICAgICBhdmNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgYXZjRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSBhYWNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhYWNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgIGFhY0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhYWNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgIG9mZnNldCArPSBkYXRhW29mZnNldF0gKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocGlkID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBBVChkYXRhLCBvZmZzZXQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgICAgIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjSWQ7XG4gICAgICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY0lkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ1RTIHBhY2tldCBkaWQgbm90IHN0YXJ0IHdpdGggMHg0Nyd9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcGFyc2UgbGFzdCBQRVMgcGFja2V0XG4gICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICB9XG4gICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICB9XG4gIH1cblxuICBlbmQoKSB7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmICghdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVJbml0U2VnbWVudCgpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFWQyBzYW1wbGVzOicgKyB0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYgKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLl9mbHVzaEFWQ1NhbXBsZXMoKTtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBBQUMgc2FtcGxlczonICsgdGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmICh0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBQUNTYW1wbGVzKCk7XG4gICAgfVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNFRCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgLy8gc2tpcCB0aGUgUFNJIGhlYWRlciBhbmQgcGFyc2UgdGhlIGZpcnN0IFBNVCBlbnRyeVxuICAgIHRoaXMuX3BtdElkICA9IChkYXRhW29mZnNldCArIDEwXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDExXTtcbiAgICAvL2xvZ2dlci5sb2coJ1BNVCBQSUQ6JyAgKyB0aGlzLl9wbXRJZCk7XG4gIH1cblxuICBfcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsIHRhYmxlRW5kLCBwcm9ncmFtSW5mb0xlbmd0aCwgcGlkO1xuICAgIHNlY3Rpb25MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgIHRhYmxlRW5kID0gb2Zmc2V0ICsgMyArIHNlY3Rpb25MZW5ndGggLSA0O1xuICAgIC8vIHRvIGRldGVybWluZSB3aGVyZSB0aGUgdGFibGUgaXMsIHdlIGhhdmUgdG8gZmlndXJlIG91dCBob3dcbiAgICAvLyBsb25nIHRoZSBwcm9ncmFtIGluZm8gZGVzY3JpcHRvcnMgYXJlXG4gICAgcHJvZ3JhbUluZm9MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCArPSAxMiArIHByb2dyYW1JbmZvTGVuZ3RoO1xuICAgIHdoaWxlIChvZmZzZXQgPCB0YWJsZUVuZCkge1xuICAgICAgcGlkID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgIHN3aXRjaChkYXRhW29mZnNldF0pIHtcbiAgICAgICAgLy8gSVNPL0lFQyAxMzgxOC03IEFEVFMgQUFDIChNUEVHLTIgbG93ZXIgYml0LXJhdGUgYXVkaW8pXG4gICAgICAgIGNhc2UgMHgwZjpcbiAgICAgICAgLy9sb2dnZXIubG9nKCdBQUMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hYWNJZCA9IHBpZDtcbiAgICAgICAgICB0aGlzLl9hYWNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vIElUVS1UIFJlYy4gSC4yNjQgYW5kIElTTy9JRUMgMTQ0OTYtMTAgKGxvd2VyIGJpdC1yYXRlIHZpZGVvKVxuICAgICAgICBjYXNlIDB4MWI6XG4gICAgICAgIC8vbG9nZ2VyLmxvZygnQVZDIFBJRDonICArIHBpZCk7XG4gICAgICAgIHRoaXMuX2F2Y0lkID0gcGlkO1xuICAgICAgICB0aGlzLl9hdmNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxvZ2dlci5sb2coJ3Vua293biBzdHJlYW0gdHlwZTonICArIGRhdGFbb2Zmc2V0XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSB0byB0aGUgbmV4dCB0YWJsZSBlbnRyeVxuICAgICAgLy8gc2tpcCBwYXN0IHRoZSBlbGVtZW50YXJ5IHN0cmVhbSBkZXNjcmlwdG9ycywgaWYgcHJlc2VudFxuICAgICAgb2Zmc2V0ICs9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MEYpIDw8IDggfCBkYXRhW29mZnNldCArIDRdKSArIDU7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEVTKHN0cmVhbSkge1xuICAgIHZhciBpID0gMCwgZnJhZywgcGVzRmxhZ3MsIHBlc1ByZWZpeCwgcGVzTGVuLCBwZXNIZHJMZW4sIHBlc0RhdGEsIHBlc1B0cywgcGVzRHRzLCBwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgLy9yZXRyaWV2ZSBQVFMvRFRTIGZyb20gZmlyc3QgZnJhZ21lbnRcbiAgICBmcmFnID0gc3RyZWFtLmRhdGFbMF07XG4gICAgcGVzUHJlZml4ID0gKGZyYWdbMF0gPDwgMTYpICsgKGZyYWdbMV0gPDwgOCkgKyBmcmFnWzJdO1xuICAgIGlmIChwZXNQcmVmaXggPT09IDEpIHtcbiAgICAgIHBlc0xlbiA9IChmcmFnWzRdIDw8IDgpICsgZnJhZ1s1XTtcbiAgICAgIHBlc0ZsYWdzID0gZnJhZ1s3XTtcbiAgICAgIGlmIChwZXNGbGFncyAmIDB4QzApIHtcbiAgICAgICAgLyogUEVTIGhlYWRlciBkZXNjcmliZWQgaGVyZSA6IGh0dHA6Ly9kdmQuc291cmNlZm9yZ2UubmV0L2R2ZGluZm8vcGVzLWhkci5odG1sXG4gICAgICAgICAgICBhcyBQVFMgLyBEVFMgaXMgMzMgYml0IHdlIGNhbm5vdCB1c2UgYml0d2lzZSBvcGVyYXRvciBpbiBKUyxcbiAgICAgICAgICAgIGFzIEJpdHdpc2Ugb3BlcmF0b3JzIHRyZWF0IHRoZWlyIG9wZXJhbmRzIGFzIGEgc2VxdWVuY2Ugb2YgMzIgYml0cyAqL1xuICAgICAgICBwZXNQdHMgPSAoZnJhZ1s5XSAmIDB4MEUpICogNTM2ODcwOTEyICsvLyAxIDw8IDI5XG4gICAgICAgICAgKGZyYWdbMTBdICYgMHhGRikgKiA0MTk0MzA0ICsvLyAxIDw8IDIyXG4gICAgICAgICAgKGZyYWdbMTFdICYgMHhGRSkgKiAxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgIChmcmFnWzEyXSAmIDB4RkYpICogMTI4ICsvLyAxIDw8IDdcbiAgICAgICAgICAoZnJhZ1sxM10gJiAweEZFKSAvIDI7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgZ3JlYXRlciB0aGFuIDJeMzIgLTFcbiAgICAgICAgICBpZiAocGVzUHRzID4gNDI5NDk2NzI5NSkge1xuICAgICAgICAgICAgLy8gZGVjcmVtZW50IDJeMzNcbiAgICAgICAgICAgIHBlc1B0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgaWYgKHBlc0ZsYWdzICYgMHg0MCkge1xuICAgICAgICAgIHBlc0R0cyA9IChmcmFnWzE0XSAmIDB4MEUgKSAqIDUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgICAgKGZyYWdbMTVdICYgMHhGRiApICogNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgICAgKGZyYWdbMTZdICYgMHhGRSApICogMTYzODQgKy8vIDEgPDwgMTRcbiAgICAgICAgICAgIChmcmFnWzE3XSAmIDB4RkYgKSAqIDEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgICAoZnJhZ1sxOF0gJiAweEZFICkgLyAyO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc0R0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICBwZXNEdHMgLT0gODU4OTkzNDU5MjtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVzRHRzID0gcGVzUHRzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwZXNIZHJMZW4gPSBmcmFnWzhdO1xuICAgICAgcGF5bG9hZFN0YXJ0T2Zmc2V0ID0gcGVzSGRyTGVuICsgOTtcbiAgICAgIC8vIHRyaW0gUEVTIGhlYWRlclxuICAgICAgc3RyZWFtLmRhdGFbMF0gPSBzdHJlYW0uZGF0YVswXS5zdWJhcnJheShwYXlsb2FkU3RhcnRPZmZzZXQpO1xuICAgICAgc3RyZWFtLnNpemUgLT0gcGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgICAgLy9yZWFzc2VtYmxlIFBFUyBwYWNrZXRcbiAgICAgIHBlc0RhdGEgPSBuZXcgVWludDhBcnJheShzdHJlYW0uc2l6ZSk7XG4gICAgICAvLyByZWFzc2VtYmxlIHRoZSBwYWNrZXRcbiAgICAgIHdoaWxlIChzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgZnJhZyA9IHN0cmVhbS5kYXRhLnNoaWZ0KCk7XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpICs9IGZyYWcuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7ZGF0YTogcGVzRGF0YSwgcHRzOiBwZXNQdHMsIGR0czogcGVzRHRzLCBsZW46IHBlc0xlbn07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZUFWQ1BFUyhwZXMpIHtcbiAgICB2YXIgdW5pdHMsdHJhY2sgPSB0aGlzLl9hdmNUcmFjaywgYXZjU2FtcGxlLCBrZXkgPSBmYWxzZTtcbiAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSk7XG4gICAgLy8gbm8gTkFMdSBmb3VuZFxuICAgIGlmICh1bml0cy5sZW5ndGggPT09IDAgJiB0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFwcGVuZCBwZXMuZGF0YSB0byBwcmV2aW91cyBOQUwgdW5pdFxuICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzW3RoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgcGVzLmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgdG1wLnNldChwZXMuZGF0YSwgbGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIGxhc3RVbml0LmRhdGEgPSB0bXA7XG4gICAgICBsYXN0YXZjU2FtcGxlLnVuaXRzLmxlbmd0aCArPSBwZXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCArPSBwZXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICAvL2ZyZWUgcGVzLmRhdGEgdG8gc2F2ZSB1cCBzb21lIG1lbW9yeVxuICAgIHBlcy5kYXRhID0gbnVsbDtcbiAgICB1bml0cy51bml0cy5mb3JFYWNoKHVuaXQgPT4ge1xuICAgICAgc3dpdGNoKHVuaXQudHlwZSkge1xuICAgICAgICAvL0lEUlxuICAgICAgICBjYXNlIDU6XG4gICAgICAgICAga2V5ID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9TUFNcbiAgICAgICAgY2FzZSA3OlxuICAgICAgICAgIGlmKCF0cmFjay5zcHMpIHtcbiAgICAgICAgICAgIHZhciBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFNQUygpO1xuICAgICAgICAgICAgdHJhY2sud2lkdGggPSBjb25maWcud2lkdGg7XG4gICAgICAgICAgICB0cmFjay5oZWlnaHQgPSBjb25maWcuaGVpZ2h0O1xuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUlkYyA9IGNvbmZpZy5wcm9maWxlSWRjO1xuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUNvbXBhdCA9IGNvbmZpZy5wcm9maWxlQ29tcGF0O1xuICAgICAgICAgICAgdHJhY2subGV2ZWxJZGMgPSBjb25maWcubGV2ZWxJZGM7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMuTVA0X1RJTUVTQ0FMRTtcbiAgICAgICAgICAgIHRyYWNrLmR1cmF0aW9uID0gdGhpcy5NUDRfVElNRVNDQUxFICogdGhpcy5fZHVyYXRpb247XG4gICAgICAgICAgICB2YXIgY29kZWNhcnJheSA9IHVuaXQuZGF0YS5zdWJhcnJheSgxLCA0KTtcbiAgICAgICAgICAgIHZhciBjb2RlY3N0cmluZyA9ICdhdmMxLic7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICBpZiAoaC5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29kZWNzdHJpbmcgKz0gaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gY29kZWNzdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1BQU1xuICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgaWYgKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvL2J1aWxkIHNhbXBsZSBmcm9tIFBFU1xuICAgIC8vIEFubmV4IEIgdG8gTVA0IGNvbnZlcnNpb24gdG8gYmUgZG9uZVxuICAgIGlmICh1bml0cy5sZW5ndGgpIHtcbiAgICAgIGF2Y1NhbXBsZSA9IHt1bml0czogdW5pdHMsIHB0czogcGVzLnB0cywgZHRzOiBwZXMuZHRzLCBrZXk6IGtleX07XG4gICAgICB0aGlzLl9hdmNTYW1wbGVzLnB1c2goYXZjU2FtcGxlKTtcbiAgICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggKz0gdW5pdHMubGVuZ3RoO1xuICAgICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSArPSB1bml0cy51bml0cy5sZW5ndGg7XG4gICAgfVxuICB9XG5cbiAgX2ZsdXNoQVZDU2FtcGxlcygpIHtcbiAgICB2YXIgdmlldywgaSA9IDgsIGF2Y1NhbXBsZSwgbXA0U2FtcGxlLCBtcDRTYW1wbGVMZW5ndGgsIHVuaXQsIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssIGxhc3RTYW1wbGVEVFMsIG1kYXQsIG1vb2YsIGZpcnN0UFRTLCBmaXJzdERUUywgcHRzLCBkdHMsIHB0c25vcm0sIGR0c25vcm0sIHNhbXBsZXMgPSBbXTtcbiAgICAvKiBjb25jYXRlbmF0ZSB0aGUgdmlkZW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1wZGF0IHR5cGUpICovXG4gICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggKyAoNCAqIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUpICsgOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCwgbWRhdC5ieXRlTGVuZ3RoKTtcbiAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCwgNCk7XG4gICAgd2hpbGUgKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzLnNoaWZ0KCk7XG4gICAgICBtcDRTYW1wbGVMZW5ndGggPSAwO1xuICAgICAgLy8gY29udmVydCBOQUxVIGJpdHN0cmVhbSB0byBNUDQgZm9ybWF0IChwcmVwZW5kIE5BTFUgd2l0aCBzaXplIGZpZWxkKVxuICAgICAgd2hpbGUgKGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgpIHtcbiAgICAgICAgdW5pdCA9IGF2Y1NhbXBsZS51bml0cy51bml0cy5zaGlmdCgpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMihpLCB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIGkgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBpKTtcbiAgICAgICAgaSArPSB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoICs9IDQgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHB0cyA9IGF2Y1NhbXBsZS5wdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgZHRzID0gYXZjU2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICAvL2xvZ2dlci5sb2coJ1ZpZGVvL1BUUy9EVFM6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzKTtcbiAgICAgIGlmIChsYXN0U2FtcGxlRFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIGxhc3RTYW1wbGVEVFMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbGFzdFNhbXBsZURUUyk7XG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdFNhbXBsZURUUykgLyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgICAgICAgaWYgKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIHRoaXMubmV4dEF2Y1B0cyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCB0aGlzLm5leHRBdmNQdHMpO1xuICAgICAgICAvLyBjaGVjayBpZiBmcmFnbWVudHMgYXJlIGNvbnRpZ3VvdXMgKGkuZS4gbm8gbWlzc2luZyBmcmFtZXMgYmV0d2VlbiBmcmFnbWVudClcbiAgICAgICAgaWYgKHRoaXMubmV4dEF2Y1B0cykge1xuICAgICAgICAgIHZhciBkZWx0YSA9IE1hdGgucm91bmQoKHB0c25vcm0gLSB0aGlzLm5leHRBdmNQdHMpIC8gOTApLCBhYnNkZWx0YSA9IE1hdGguYWJzKGRlbHRhKTtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fic2RlbHRhL2F2Y1NhbXBsZS5wdHM6JyArIGFic2RlbHRhICsgJy8nICsgYXZjU2FtcGxlLnB0cyk7XG4gICAgICAgICAgLy8gaWYgZGVsdGEgaXMgbGVzcyB0aGFuIDMwMCBtcywgbmV4dCBsb2FkZWQgZnJhZ21lbnQgaXMgYXNzdW1lZCB0byBiZSBjb250aWd1b3VzIHdpdGggbGFzdCBvbmVcbiAgICAgICAgICBpZiAoYWJzZGVsdGEgPCAzMDApIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnVmlkZW8gbmV4dCBQVFM6JyArIHRoaXMubmV4dEF2Y1B0cyk7XG4gICAgICAgICAgICBpZiAoZGVsdGEgPiAxKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzoke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkLGZpbGxpbmcgaXRgKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBQVFMgdG8gbmV4dCBQVFNcbiAgICAgICAgICAgIHB0c25vcm0gPSB0aGlzLm5leHRBdmNQdHM7XG4gICAgICAgICAgICAvLyBvZmZzZXQgRFRTIGFzIHdlbGwsIGVuc3VyZSB0aGF0IERUUyBpcyBzbWFsbGVyIG9yIGVxdWFsIHRoYW4gbmV3IFBUU1xuICAgICAgICAgICAgZHRzbm9ybSA9IE1hdGgubWF4KGR0c25vcm0gLSBkZWx0YSwgdGhpcy5sYXN0QXZjRHRzKTtcbiAgICAgICAgICAgLy8gbG9nZ2VyLmxvZygnVmlkZW8vUFRTL0RUUyBhZGp1c3RlZDonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vdCBjb250aWd1b3VzIHRpbWVzdGFtcCwgY2hlY2sgaWYgUFRTIGlzIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgICAgICB2YXIgZXhwZWN0ZWRQVFMgPSB0aGlzLlBFU19USU1FU0NBTEUgKiB0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB0aGVyZSBpcyBhbnkgdW5leHBlY3RlZCBkcmlmdCBiZXR3ZWVuIGV4cGVjdGVkIHRpbWVzdGFtcCBhbmQgcmVhbCBvbmVcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhleHBlY3RlZFBUUyAtIHB0c25vcm0pID4gKHRoaXMuUEVTX1RJTUVTQ0FMRSAqIDM2MDApKSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnUFRTIGxvb3BpbmcgPz8/IEFWQyBQVFMgZGVsdGE6JHtleHBlY3RlZFBUUy1wdHNub3JtfScpO1xuICAgICAgICAgICAgICB2YXIgcHRzT2Zmc2V0ID0gZXhwZWN0ZWRQVFMgLSBwdHNub3JtO1xuICAgICAgICAgICAgICAvLyBzZXQgUFRTIHRvIG5leHQgZXhwZWN0ZWQgUFRTO1xuICAgICAgICAgICAgICBwdHNub3JtID0gZXhwZWN0ZWRQVFM7XG4gICAgICAgICAgICAgIGR0c25vcm0gPSBwdHNub3JtO1xuICAgICAgICAgICAgICAvLyBvZmZzZXQgaW5pdFBUUy9pbml0RFRTIHRvIGZpeCBjb21wdXRhdGlvbiBmb3IgZm9sbG93aW5nIHNhbXBsZXNcbiAgICAgICAgICAgICAgdGhpcy5faW5pdFBUUyAtPSBwdHNPZmZzZXQ7XG4gICAgICAgICAgICAgIHRoaXMuX2luaXREVFMgLT0gcHRzT2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGF2Y1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsIHB0c25vcm0pO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsIGR0c25vcm0pO1xuICAgICAgfVxuICAgICAgLy9jb25zb2xlLmxvZygnUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2F2Y1NhbXBsZS5wdHN9LyR7YXZjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYXZjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfScpO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgIGR1cmF0aW9uOiAwLFxuICAgICAgICBjdHM6IChwdHNub3JtIC0gZHRzbm9ybSkgLyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUixcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMTtcbiAgICAgIH1cbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdFNhbXBsZURUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIGlmIChzYW1wbGVzLmxlbmd0aCA+PSAyKSB7XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMl0uZHVyYXRpb247XG4gICAgfVxuICAgIHRoaXMubGFzdEF2Y0R0cyA9IGR0c25vcm07XG4gICAgLy8gbmV4dCBBVkMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBdmNQdHMgPSBwdHNub3JtICsgbXA0U2FtcGxlLmR1cmF0aW9uICogdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gICAgLy9sb2dnZXIubG9nKCdWaWRlby9sYXN0QXZjRHRzL25leHRBdmNQdHM6JyArIHRoaXMubGFzdEF2Y0R0cyArICcvJyArIHRoaXMubmV4dEF2Y1B0cyk7XG4gICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSA9IDA7XG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssIGZpcnN0RFRTIC8gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsIHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUzogZmlyc3RQVFMgLyB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICBlbmRQVFM6IHRoaXMubmV4dEF2Y1B0cyAvIHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIGVuZERUUzogKGR0c25vcm0gKyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUiAqIG1wNFNhbXBsZS5kdXJhdGlvbikgLyB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICB0eXBlOiAndmlkZW8nLFxuICAgICAgbmI6IHNhbXBsZXMubGVuZ3RoXG4gICAgfSk7XG4gIH1cblxuICBfcGFyc2VBVkNOQUx1KGFycmF5KSB7XG4gICAgdmFyIGkgPSAwLCBsZW4gPSBhcnJheS5ieXRlTGVuZ3RoLCB2YWx1ZSwgb3ZlcmZsb3csIHN0YXRlID0gMDtcbiAgICB2YXIgdW5pdHMgPSBbXSwgdW5pdCwgdW5pdFR5cGUsIGxhc3RVbml0U3RhcnQsIGxhc3RVbml0VHlwZSwgbGVuZ3RoID0gMDtcbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoYXJyYXkpKTtcbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgdmFsdWUgPSBhcnJheVtpKytdO1xuICAgICAgLy8gZmluZGluZyAzIG9yIDQtYnl0ZSBzdGFydCBjb2RlcyAoMDAgMDAgMDEgT1IgMDAgMDAgMDAgMDEpXG4gICAgICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgICAgIGNhc2UgMDpcbiAgICAgICAgICBpZiAodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgaWYoIHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gMSkge1xuICAgICAgICAgICAgdW5pdFR5cGUgPSBhcnJheVtpXSAmIDB4MWY7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgTkFMVSBAIG9mZnNldDonICsgaSArICcsdHlwZTonICsgdW5pdFR5cGUpO1xuICAgICAgICAgICAgaWYgKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgICAgICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBpIC0gc3RhdGUgLSAxKSwgdHlwZTogbGFzdFVuaXRUeXBlfTtcbiAgICAgICAgICAgICAgbGVuZ3RoICs9IGkgLSBzdGF0ZSAtIDEgLSBsYXN0VW5pdFN0YXJ0O1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiBOQUwgdW5pdHMgYXJlIG5vdCBzdGFydGluZyByaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGFja2V0LCBwdXNoIHByZWNlZGluZyBkYXRhIGludG8gcHJldmlvdXMgTkFMIHVuaXQuXG4gICAgICAgICAgICAgIG92ZXJmbG93ICA9IGkgLSBzdGF0ZSAtIDE7XG4gICAgICAgICAgICAgIGlmIChvdmVyZmxvdykge1xuICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHRoaXMuX2F2Y1NhbXBsZXNbdGhpcy5fYXZjU2FtcGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChhcnJheS5zdWJhcnJheSgwLCBvdmVyZmxvdyksIGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGggKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIGlmICh1bml0VHlwZSA9PT0gMSB8fCB1bml0VHlwZSA9PT0gNSkge1xuICAgICAgICAgICAgICAvLyBPUFRJICEhISBpZiBJRFIvTkRSIHVuaXQsIGNvbnNpZGVyIGl0IGlzIGxhc3QgTkFMdVxuICAgICAgICAgICAgICBpID0gbGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBsZW4pLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgbGVuZ3RoICs9IGxlbiAtIGxhc3RVbml0U3RhcnQ7XG4gICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4ge3VuaXRzOiB1bml0cyAsIGxlbmd0aDogbGVuZ3RofTtcbiAgfVxuXG4gIF9QVFNOb3JtYWxpemUodmFsdWUsIHJlZmVyZW5jZSkge1xuICAgIHZhciBvZmZzZXQ7XG4gICAgaWYgKHJlZmVyZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChyZWZlcmVuY2UgPCB2YWx1ZSkge1xuICAgICAgLy8gLSAyXjMzXG4gICAgICBvZmZzZXQgPSAtODU4OTkzNDU5MjtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gKyAyXjMzXG4gICAgICBvZmZzZXQgPSA4NTg5OTM0NTkyO1xuICAgIH1cbiAgICAvKiBQVFMgaXMgMzNiaXQgKGZyb20gMCB0byAyXjMzIC0xKVxuICAgICAgaWYgZGlmZiBiZXR3ZWVuIHZhbHVlIGFuZCByZWZlcmVuY2UgaXMgYmlnZ2VyIHRoYW4gaGFsZiBvZiB0aGUgYW1wbGl0dWRlICgyXjMyKSB0aGVuIGl0IG1lYW5zIHRoYXRcbiAgICAgIFBUUyBsb29waW5nIG9jY3VyZWQuIGZpbGwgdGhlIGdhcCAqL1xuICAgIHdoaWxlIChNYXRoLmFicyh2YWx1ZSAtIHJlZmVyZW5jZSkgPiA0Mjk0OTY3Mjk2KSB7XG4gICAgICAgIHZhbHVlICs9IG9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLCBhYWNTYW1wbGUsIGRhdGEgPSBwZXMuZGF0YSwgY29uZmlnLCBhZHRzRnJhbWVTaXplLCBhZHRzU3RhcnRPZmZzZXQsIGFkdHNIZWFkZXJMZW4sIHN0YW1wLCBuYlNhbXBsZXMsIGxlbjtcbiAgICBpZiAodGhpcy5hYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KHRoaXMuYWFjT3ZlckZsb3cuYnl0ZUxlbmd0aCArIGRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KHRoaXMuYWFjT3ZlckZsb3csIDApO1xuICAgICAgdG1wLnNldChkYXRhLCB0aGlzLmFhY092ZXJGbG93LmJ5dGVMZW5ndGgpO1xuICAgICAgZGF0YSA9IHRtcDtcbiAgICB9XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IgKGFkdHNTdGFydE9mZnNldCA9IDAsIGxlbiA9IGRhdGEubGVuZ3RoOyBhZHRzU3RhcnRPZmZzZXQgPCBsZW4gLSAxOyBhZHRzU3RhcnRPZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW2FkdHNTdGFydE9mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmIChhZHRzU3RhcnRPZmZzZXQpIHtcbiAgICAgIHZhciByZWFzb24sIGZhdGFsO1xuICAgICAgaWYgKGFkdHNTdGFydE9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke2FkdHNTdGFydE9mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gJ25vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVMnO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhdGFsLCByZWFzb246IHJlYXNvbn0pO1xuICAgICAgaWYgKGZhdGFsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgIGNvbmZpZyA9IHRoaXMuX0FEVFN0b0F1ZGlvQ29uZmlnKGRhdGEsIGFkdHNTdGFydE9mZnNldCwgdGhpcy5hdWRpb0NvZGVjKTtcbiAgICAgIHRyYWNrLmNvbmZpZyA9IGNvbmZpZy5jb25maWc7XG4gICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICB0cmFjay5jb2RlYyA9IGNvbmZpZy5jb2RlYztcbiAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMuTVA0X1RJTUVTQ0FMRTtcbiAgICAgIHRyYWNrLmR1cmF0aW9uID0gdGhpcy5NUDRfVElNRVNDQUxFICogdGhpcy5fZHVyYXRpb247XG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICB9XG4gICAgbmJTYW1wbGVzID0gMDtcbiAgICB3aGlsZSAoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgbGVuKSB7XG4gICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDNdICYgMHgwMykgPDwgMTEpO1xuICAgICAgLy8gYnl0ZSA0XG4gICAgICBhZHRzRnJhbWVTaXplIHw9IChkYXRhW2FkdHNTdGFydE9mZnNldCArIDRdIDw8IDMpO1xuICAgICAgLy8gYnl0ZSA1XG4gICAgICBhZHRzRnJhbWVTaXplIHw9ICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyA1XSAmIDB4RTApID4+PiA1KTtcbiAgICAgIGFkdHNIZWFkZXJMZW4gPSAoISEoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgYWR0c0ZyYW1lU2l6ZSAtPSBhZHRzSGVhZGVyTGVuO1xuICAgICAgc3RhbXAgPSBNYXRoLnJvdW5kKHBlcy5wdHMgKyBuYlNhbXBsZXMgKiAxMDI0ICogdGhpcy5QRVNfVElNRVNDQUxFIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlKTtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuICAgICAgLy9jb25zb2xlLmxvZygnQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3B0czonICsgKGFkdHNTdGFydE9mZnNldCs3KSArICcvJyArIGFkdHNGcmFtZVNpemUgKyAnLycgKyBzdGFtcC50b0ZpeGVkKDApKTtcbiAgICAgIGlmIChhZHRzU3RhcnRPZmZzZXQgKyBhZHRzSGVhZGVyTGVuICsgYWR0c0ZyYW1lU2l6ZSA8PSBsZW4pIHtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiwgYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiArIGFkdHNGcmFtZVNpemUpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdGhpcy5fYWFjU2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggKz0gYWR0c0ZyYW1lU2l6ZTtcbiAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0ICs9IGFkdHNGcmFtZVNpemUgKyBhZHRzSGVhZGVyTGVuO1xuICAgICAgICBuYlNhbXBsZXMrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuKSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShhZHRzU3RhcnRPZmZzZXQsIGxlbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9mbHVzaEFBQ1NhbXBsZXMoKSB7XG4gICAgdmFyIHZpZXcsIGkgPSA4LCBhYWNTYW1wbGUsIG1wNFNhbXBsZSwgdW5pdCwgdHJhY2sgPSB0aGlzLl9hYWNUcmFjaywgbGFzdFNhbXBsZURUUywgbWRhdCwgbW9vZiwgZmlyc3RQVFMsIGZpcnN0RFRTLCBwdHMsIGR0cywgcHRzbm9ybSwgZHRzbm9ybSwgc2FtcGxlcyA9IFtdO1xuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYWFjU2FtcGxlc0xlbmd0aCArIDgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgIHdoaWxlICh0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgYWFjU2FtcGxlID0gdGhpcy5fYWFjU2FtcGxlcy5zaGlmdCgpO1xuICAgICAgdW5pdCA9IGFhY1NhbXBsZS51bml0O1xuICAgICAgbWRhdC5zZXQodW5pdCwgaSk7XG4gICAgICBpICs9IHVuaXQuYnl0ZUxlbmd0aDtcbiAgICAgIHB0cyA9IGFhY1NhbXBsZS5wdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgZHRzID0gYWFjU2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUzonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApKTtcbiAgICAgIGlmIChsYXN0U2FtcGxlRFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIGxhc3RTYW1wbGVEVFMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbGFzdFNhbXBsZURUUyk7XG4gICAgICAgIC8vIHdlIHVzZSBEVFMgdG8gY29tcHV0ZSBzYW1wbGUgZHVyYXRpb24sIGJ1dCB3ZSB1c2UgUFRTIHRvIGNvbXB1dGUgaW5pdFBUUyB3aGljaCBpcyB1c2VkIHRvIHN5bmMgYXVkaW8gYW5kIHZpZGVvXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdFNhbXBsZURUUykgLyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgICAgICAgaWYgKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIHRoaXMubmV4dEFhY1B0cyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCB0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICAvLyBjaGVjayBpZiBmcmFnbWVudHMgYXJlIGNvbnRpZ3VvdXMgKGkuZS4gbm8gbWlzc2luZyBmcmFtZXMgYmV0d2VlbiBmcmFnbWVudClcbiAgICAgICAgaWYgKHRoaXMubmV4dEFhY1B0cyAmJiB0aGlzLm5leHRBYWNQdHMgIT09IHB0c25vcm0pIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvIG5leHQgUFRTOicgKyB0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICAgIHZhciBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCAqIChwdHNub3JtIC0gdGhpcy5uZXh0QWFjUHRzKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSksIGFic2RlbHRhID0gTWF0aC5hYnMoZGVsdGEpO1xuICAgICAgICAgIC8vIGlmIGRlbHRhIGlzIGxlc3MgdGhhbiAzMDAgbXMsIG5leHQgbG9hZGVkIGZyYWdtZW50IGlzIGFzc3VtZWQgdG8gYmUgY29udGlndW91cyB3aXRoIGxhc3Qgb25lXG4gICAgICAgICAgaWYgKGFic2RlbHRhID4gMSAmJiBhYnNkZWx0YSA8IDMwMCkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBQUM6JHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4gICAgICAgICAgICAgIC8vIHNldCBQVFMgdG8gbmV4dCBQVFMsIGFuZCBlbnN1cmUgUFRTIGlzIGdyZWF0ZXIgb3IgZXF1YWwgdGhhbiBsYXN0IERUU1xuICAgICAgICAgICAgICBwdHNub3JtID0gTWF0aC5tYXgodGhpcy5uZXh0QWFjUHRzLCB0aGlzLmxhc3RBYWNEdHMpO1xuICAgICAgICAgICAgICBkdHNub3JtID0gcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvRFRTIGFkanVzdGVkOicgKyBhYWNTYW1wbGUucHRzICsgJy8nICsgYWFjU2FtcGxlLmR0cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBQUM6JHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAoYWJzZGVsdGEpIHtcbiAgICAgICAgICAgIC8vIG5vdCBjb250aWd1b3VzIHRpbWVzdGFtcCwgY2hlY2sgaWYgUFRTIGlzIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgICAgICB2YXIgZXhwZWN0ZWRQVFMgPSB0aGlzLlBFU19USU1FU0NBTEUgKiB0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2V4cGVjdGVkUFRTL1BUU25vcm06JHtleHBlY3RlZFBUU30vJHtwdHNub3JtfS8ke2V4cGVjdGVkUFRTLXB0c25vcm19Jyk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB0aGVyZSBpcyBhbnkgdW5leHBlY3RlZCBkcmlmdCBiZXR3ZWVuIGV4cGVjdGVkIHRpbWVzdGFtcCBhbmQgcmVhbCBvbmVcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhleHBlY3RlZFBUUyAtIHB0c25vcm0pID4gdGhpcy5QRVNfVElNRVNDQUxFICogMzYwMCkge1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ1BUUyBsb29waW5nID8/PyBBQUMgUFRTIGRlbHRhOiR7ZXhwZWN0ZWRQVFMtcHRzbm9ybX0nKTtcbiAgICAgICAgICAgICAgdmFyIHB0c09mZnNldCA9IGV4cGVjdGVkUFRTIC0gcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IGV4cGVjdGVkIFBUUztcbiAgICAgICAgICAgICAgcHRzbm9ybSA9IGV4cGVjdGVkUFRTO1xuICAgICAgICAgICAgICBkdHNub3JtID0gcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gb2Zmc2V0IGluaXRQVFMvaW5pdERUUyB0byBmaXggY29tcHV0YXRpb24gZm9yIGZvbGxvd2luZyBzYW1wbGVzXG4gICAgICAgICAgICAgIHRoaXMuX2luaXRQVFMgLT0gcHRzT2Zmc2V0O1xuICAgICAgICAgICAgICB0aGlzLl9pbml0RFRTIC09IHB0c09mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhYWNTYW1wbGVzLCBlbnN1cmUgdmFsdWUgaXMgcG9zaXRpdmVcbiAgICAgICAgZmlyc3RQVFMgPSBNYXRoLm1heCgwLCBwdHNub3JtKTtcbiAgICAgICAgZmlyc3REVFMgPSBNYXRoLm1heCgwLCBkdHNub3JtKTtcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2coJ1BUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthYWNTYW1wbGUucHRzfS8ke2FhY1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGFhY1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX0nKTtcbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogdW5pdC5ieXRlTGVuZ3RoLFxuICAgICAgICBjdHM6IDAsXG4gICAgICAgIGR1cmF0aW9uOjAsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0U2FtcGxlRFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIGlmIChzYW1wbGVzLmxlbmd0aCA+PSAyKSB7XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMl0uZHVyYXRpb247XG4gICAgfVxuICAgIHRoaXMubGFzdEFhY0R0cyA9IGR0c25vcm07XG4gICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBYWNQdHMgPSBwdHNub3JtICsgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IgKiBtcDRTYW1wbGUuZHVyYXRpb247XG4gICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvUFRTZW5kOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkgKyAnLycgKyB0aGlzLm5leHRBYWNEdHMudG9GaXhlZCgwKSk7XG4gICAgdGhpcy5fYWFjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssIGZpcnN0RFRTIC8gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsIHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUzogZmlyc3RQVFMgLyB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICBlbmRQVFM6IHRoaXMubmV4dEFhY1B0cyAvIHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIGVuZERUUzogKGR0c25vcm0gKyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUiAqIG1wNFNhbXBsZS5kdXJhdGlvbikgLyB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICB0eXBlOiAnYXVkaW8nLFxuICAgICAgbmI6IHNhbXBsZXMubGVuZ3RoXG4gICAgfSk7XG4gIH1cblxuICBfQURUU3RvQXVkaW9Db25maWcoZGF0YSwgb2Zmc2V0LCBhdWRpb0NvZGVjKSB7XG4gICAgdmFyIGFkdHNPYmplY3RUeXBlLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBjb25maWcsXG4gICAgICAgIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgICAgICAgICAgOTYwMDAsIDg4MjAwLFxuICAgICAgICAgICAgNjQwMDAsIDQ4MDAwLFxuICAgICAgICAgICAgNDQxMDAsIDMyMDAwLFxuICAgICAgICAgICAgMjQwMDAsIDIyMDUwLFxuICAgICAgICAgICAgMTYwMDAsIDEyMDAwXG4gICAgICAgICAgXTtcbiAgICAvLyBieXRlIDJcbiAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgYWR0c1NhbXBsZWluZ0luZGV4ID0gKChkYXRhW29mZnNldCArIDJdICYgMHgzQykgPj4+IDIpO1xuICAgIGFkdHNDaGFuZWxDb25maWcgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDAxKSA8PCAyKTtcbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4QzApID4+PiA2KTtcbiAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBjb2RlYzoke2F1ZGlvQ29kZWN9LEFEVFMgZGF0YTp0eXBlOiR7YWR0c09iamVjdFR5cGV9LHNhbXBsZWluZ0luZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fVske2FkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdfWtIel0sY2hhbm5lbENvbmZpZzoke2FkdHNDaGFuZWxDb25maWd9YCk7XG4gICAgLy8gZmlyZWZveDogZnJlcSBsZXNzIHRoYW4gMjRrSHogPSBBQUMgU0JSIChIRS1BQUMpXG4gICAgaWYgKHVzZXJBZ2VudC5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xKSB7XG4gICAgICBpZiAoYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICAgIC8vIEFuZHJvaWQgOiBhbHdheXMgdXNlIEFBQ1xuICAgIH0gZWxzZSBpZiAodXNlckFnZW50LmluZGV4T2YoJ2FuZHJvaWQnKSAhPT0gLTEpIHtcbiAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgLyogIGZvciBvdGhlciBicm93c2VycyAoY2hyb21lIC4uLilcbiAgICAgICAgICBhbHdheXMgZm9yY2UgYXVkaW8gdHlwZSB0byBiZSBIRS1BQUMgU0JSLCBhcyBzb21lIGJyb3dzZXJzIGRvIG5vdCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaCBwcm9wZXJseSAobGlrZSBDaHJvbWUgLi4uKVxuICAgICAgKi9cbiAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBIRS1BQUMpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIEFORCBmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6KVxuICAgICAgaWYgKChhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSB8fCAoIWF1ZGlvQ29kZWMgJiYgYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpKSB7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEFBQykgQU5EIChmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6IE9SIG5iIGNoYW5uZWwgaXMgMSlcbiAgICAgICAgaWYgKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEgJiYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2IHx8IGFkdHNDaGFuZWxDb25maWcgPT09IDEpKSB7XG4gICAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgfVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgICAgSVNPIDE0NDk2LTMgKEFBQykucGRmIC0gVGFibGUgMS4xMyDigJQgU3ludGF4IG9mIEF1ZGlvU3BlY2lmaWNDb25maWcoKVxuICAgICAgQXVkaW8gUHJvZmlsZSAvIEF1ZGlvIE9iamVjdCBUeXBlXG4gICAgICAwOiBOdWxsXG4gICAgICAxOiBBQUMgTWFpblxuICAgICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgICA2OiBBQUMgU2NhbGFibGVcbiAgICAgc2FtcGxpbmcgZnJlcVxuICAgICAgMDogOTYwMDAgSHpcbiAgICAgIDE6IDg4MjAwIEh6XG4gICAgICAyOiA2NDAwMCBIelxuICAgICAgMzogNDgwMDAgSHpcbiAgICAgIDQ6IDQ0MTAwIEh6XG4gICAgICA1OiAzMjAwMCBIelxuICAgICAgNjogMjQwMDAgSHpcbiAgICAgIDc6IDIyMDUwIEh6XG4gICAgICA4OiAxNjAwMCBIelxuICAgICAgOTogMTIwMDAgSHpcbiAgICAgIDEwOiAxMTAyNSBIelxuICAgICAgMTE6IDgwMDAgSHpcbiAgICAgIDEyOiA3MzUwIEh6XG4gICAgICAxMzogUmVzZXJ2ZWRcbiAgICAgIDE0OiBSZXNlcnZlZFxuICAgICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgICAgVGhlc2UgYXJlIHRoZSBjaGFubmVsIGNvbmZpZ3VyYXRpb25zOlxuICAgICAgMDogRGVmaW5lZCBpbiBBT1QgU3BlY2lmYyBDb25maWdcbiAgICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgICAyOiAyIGNoYW5uZWxzOiBmcm9udC1sZWZ0LCBmcm9udC1yaWdodFxuICAgICovXG4gICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICBjb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuICAgIC8vIHNhbXBsaW5nRnJlcXVlbmN5SW5kZXhcbiAgICBjb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgY29uZmlnWzFdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcbiAgICBpZiAoYWR0c09iamVjdFR5cGUgPT09IDUpIHtcbiAgICAgIC8vIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleFxuICAgICAgY29uZmlnWzFdIHw9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgICAgY29uZmlnWzJdID0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgICAvLyBhZHRzT2JqZWN0VHlwZSAoZm9yY2UgdG8gMiwgY2hyb21lIGlzIGNoZWNraW5nIHRoYXQgb2JqZWN0IHR5cGUgaXMgbGVzcyB0aGFuIDUgPz8/XG4gICAgICAvLyAgICBodHRwczovL2Nocm9taXVtLmdvb2dsZXNvdXJjZS5jb20vY2hyb21pdW0vc3JjLmdpdC8rL21hc3Rlci9tZWRpYS9mb3JtYXRzL21wNC9hYWMuY2NcbiAgICAgIGNvbmZpZ1syXSB8PSAyIDw8IDI7XG4gICAgICBjb25maWdbM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4ge2NvbmZpZzogY29uZmlnLCBzYW1wbGVyYXRlOiBhZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XSwgY2hhbm5lbENvdW50OiBhZHRzQ2hhbmVsQ29uZmlnLCBjb2RlYzogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG5cbiAgX2dlbmVyYXRlSW5pdFNlZ21lbnQoKSB7XG4gICAgaWYgKHRoaXMuX2F2Y0lkID09PSAtMSkge1xuICAgICAgLy9hdWRpbyBvbmx5XG4gICAgICBpZiAodGhpcy5fYWFjVHJhY2suY29uZmlnKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHtcbiAgICAgICAgICBhdWRpb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYWFjVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjIDogdGhpcy5fYWFjVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQgOiB0aGlzLl9hYWNUcmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9hYWNTYW1wbGVzWzBdLnB0cyAtIHRoaXMuUEVTX1RJTUVTQ0FMRSAqIHRoaXMudGltZU9mZnNldDtcbiAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzIC0gdGhpcy5QRVNfVElNRVNDQUxFICogdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgfVxuICAgIH0gZWxzZVxuICAgIGlmICh0aGlzLl9hYWNJZCA9PT0gLTEpIHtcbiAgICAgIC8vdmlkZW8gb25seVxuICAgICAgaWYgKHRoaXMuX2F2Y1RyYWNrLnNwcyAmJiB0aGlzLl9hdmNUcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwge1xuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWM6IHRoaXMuX2F2Y1RyYWNrLmNvZGVjLFxuICAgICAgICAgIHZpZGVvV2lkdGg6IHRoaXMuX2F2Y1RyYWNrLndpZHRoLFxuICAgICAgICAgIHZpZGVvSGVpZ2h0OiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9hdmNTYW1wbGVzWzBdLnB0cyAtIHRoaXMuUEVTX1RJTUVTQ0FMRSAqIHRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gdGhpcy5fYXZjU2FtcGxlc1swXS5kdHMgLSB0aGlzLlBFU19USU1FU0NBTEUgKiB0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy9hdWRpbyBhbmQgdmlkZW9cbiAgICAgIGlmICh0aGlzLl9hYWNUcmFjay5jb25maWcgJiYgdGhpcy5fYXZjVHJhY2suc3BzICYmIHRoaXMuX2F2Y1RyYWNrLnBwcykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYzogdGhpcy5fYWFjVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQ6IHRoaXMuX2FhY1RyYWNrLmNoYW5uZWxDb3VudCxcbiAgICAgICAgICB2aWRlb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYXZjVHJhY2tdKSxcbiAgICAgICAgICB2aWRlb0NvZGVjOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoOiB0aGlzLl9hdmNUcmFjay53aWR0aCxcbiAgICAgICAgICB2aWRlb0hlaWdodDogdGhpcy5fYXZjVHJhY2suaGVpZ2h0XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgICB0aGlzLl9pbml0UFRTID0gTWF0aC5taW4odGhpcy5fYXZjU2FtcGxlc1swXS5wdHMsIHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzKSAtIHRoaXMuUEVTX1RJTUVTQ0FMRSAqIHRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gTWF0aC5taW4odGhpcy5fYXZjU2FtcGxlc1swXS5kdHMsIHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzKSAtIHRoaXMuUEVTX1RJTUVTQ0FMRSAqIHRoaXMudGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXI7XG5cbiIsIiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyIGZyb20gJy4uL2RlbXV4L3RzZGVtdXhlcic7XG4gaW1wb3J0IG9ic2VydmVyIGZyb20gJy4uL29ic2VydmVyJztcblxudmFyIFRTRGVtdXhlcldvcmtlciA9IGZ1bmN0aW9uIChzZWxmKSB7XG4gIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBldi5kYXRhLmNtZCk7XG4gICAgc3dpdGNoIChldi5kYXRhLmNtZCkge1xuICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdkZW11eCc6XG4gICAgICAgIHNlbGYuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGV2LmRhdGEuZGF0YSksIGV2LmRhdGEuYXVkaW9Db2RlYywgZXYuZGF0YS52aWRlb0NvZGVjLCBldi5kYXRhLnRpbWVPZmZzZXQsIGV2LmRhdGEuY2MsIGV2LmRhdGEubGV2ZWwsIGV2LmRhdGEuZHVyYXRpb24pO1xuICAgICAgICBzZWxmLmRlbXV4ZXIuZW5kKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9KTtcblxuICAvLyBsaXN0ZW4gdG8gZXZlbnRzIHRyaWdnZXJlZCBieSBUUyBEZW11eGVyXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIGZ1bmN0aW9uKGV2LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2fTtcbiAgICB2YXIgb2JqVHJhbnNmZXJhYmxlID0gW107XG4gICAgaWYgKGRhdGEuYXVkaW9Db2RlYykge1xuICAgICAgb2JqRGF0YS5hdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgb2JqRGF0YS5hdWRpb01vb3YgPSBkYXRhLmF1ZGlvTW9vdi5idWZmZXI7XG4gICAgICBvYmpEYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID0gZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEuYXVkaW9Nb292KTtcbiAgICB9XG4gICAgaWYgKGRhdGEudmlkZW9Db2RlYykge1xuICAgICAgb2JqRGF0YS52aWRlb0NvZGVjID0gZGF0YS52aWRlb0NvZGVjO1xuICAgICAgb2JqRGF0YS52aWRlb01vb3YgPSBkYXRhLnZpZGVvTW9vdi5idWZmZXI7XG4gICAgICBvYmpEYXRhLnZpZGVvV2lkdGggPSBkYXRhLnZpZGVvV2lkdGg7XG4gICAgICBvYmpEYXRhLnZpZGVvSGVpZ2h0ID0gZGF0YS52aWRlb0hlaWdodDtcbiAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEudmlkZW9Nb292KTtcbiAgICB9XG4gICAgLy8gcGFzcyBtb292IGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLG9ialRyYW5zZmVyYWJsZSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCBmdW5jdGlvbihldiwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldiwgdHlwZTogZGF0YS50eXBlLCBzdGFydFBUUzogZGF0YS5zdGFydFBUUywgZW5kUFRTOiBkYXRhLmVuZFBUUywgc3RhcnREVFM6IGRhdGEuc3RhcnREVFMsIGVuZERUUzogZGF0YS5lbmREVFMsIG1vb2Y6IGRhdGEubW9vZi5idWZmZXIsIG1kYXQ6IGRhdGEubWRhdC5idWZmZXIsIG5iOiBkYXRhLm5ifTtcbiAgICAvLyBwYXNzIG1vb2YvbWRhdCBkYXRhIGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLCBbb2JqRGF0YS5tb29mLCBvYmpEYXRhLm1kYXRdKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2ZW50fSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkVSUk9SLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldmVudCwgZGF0YTogZGF0YX0pO1xuICB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcldvcmtlcjtcblxuIiwiZXhwb3J0IHZhciBFcnJvclR5cGVzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG5ldHdvcmsgZXJyb3IgKGxvYWRpbmcgZXJyb3IgLyB0aW1lb3V0IC4uLilcbiAgTkVUV09SS19FUlJPUjogJ2hsc05ldHdvcmtFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWVkaWEgRXJyb3IgKHZpZGVvL3BhcnNpbmcvbWVkaWFzb3VyY2UgZXJyb3IpXG4gIE1FRElBX0VSUk9SOiAnaGxzTWVkaWFFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFsbCBvdGhlciBlcnJvcnNcbiAgT1RIRVJfRVJST1I6ICdobHNPdGhlckVycm9yJ1xufTtcblxuZXhwb3J0IHZhciBFcnJvckRldGFpbHMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZCBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfRVJST1I6ICdtYW5pZmVzdExvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZCB0aW1lb3V0IC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTUFOSUZFU1RfTE9BRF9USU1FT1VUOiAnbWFuaWZlc3RMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgcGFyc2luZyBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVhc29uIDogZXJyb3IgcmVhc29ufVxuICBNQU5JRkVTVF9QQVJTSU5HX0VSUk9SOiAnbWFuaWZlc3RQYXJzaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9FUlJPUjogJ2xldmVsTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgcGxheWxpc3QgbG9hZCB0aW1lb3V0IC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9USU1FT1VUOiAnbGV2ZWxMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGVycm9yIC0gZGF0YTogeyBsZXZlbCA6IGZhdWx0eSBsZXZlbCBJZCwgZXZlbnQgOiBlcnJvciBkZXNjcmlwdGlvbn1cbiAgTEVWRUxfU1dJVENIX0VSUk9SOiAnbGV2ZWxTd2l0Y2hFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBGUkFHX0xPQURfRVJST1I6ICdmcmFnTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPT1BfTE9BRElOR19FUlJPUjogJ2ZyYWdMb29wTG9hZGluZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfVElNRU9VVDogJ2ZyYWdMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19QQVJTSU5HX0VSUk9SOiAnZnJhZ1BhcnNpbmdFcnJvcicsXG4gICAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBhcHBlbmRpbmcgZXJyb3IgZXZlbnQgLSBkYXRhOiBhcHBlbmRpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19BUFBFTkRJTkdfRVJST1I6ICdmcmFnQXBwZW5kaW5nRXJyb3InXG59O1xuIiwiZXhwb3J0IGRlZmF1bHQge1xuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIHN1Y2Nlc2Z1bGx5IGF0dGFjaGVkIHRvIHZpZGVvIGVsZW1lbnQgLSBkYXRhOiB7IG1lZGlhU291cmNlIH1cbiAgTVNFX0FUVEFDSEVEOiAnaGxzTWVkaWFTb3VyY2VBdHRhY2hlZCcsXG4gIC8vIGZpcmVkIHdoZW4gTWVkaWFTb3VyY2UgaGFzIGJlZW4gZGV0YWNoZWQgZnJvbSB2aWRlbyBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1TRV9ERVRBQ0hFRDogJ2hsc01lZGlhU291cmNlRGV0YWNoZWQnLFxuICAvLyBmaXJlZCB0byBzaWduYWwgdGhhdCBhIG1hbmlmZXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBtYW5pZmVzdFVSTH1cbiAgTUFOSUZFU1RfTE9BRElORzogJ2hsc01hbmlmZXN0TG9hZGluZycsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIGxvYWRlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCB1cmwgOiBtYW5pZmVzdFVSTCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX19XG4gIE1BTklGRVNUX0xPQURFRDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gcGFyc2VkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIGZpcnN0TGV2ZWwgOiBpbmRleCBvZiBmaXJzdCBxdWFsaXR5IGxldmVsIGFwcGVhcmluZyBpbiBNYW5pZmVzdH1cbiAgTUFOSUZFU1RfUEFSU0VEOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IGxldmVsIFVSTCAgbGV2ZWwgOiBpZCBvZiBsZXZlbCBiZWluZyBsb2FkZWR9XG4gIExFVkVMX0xPQURJTkc6ICdobHNMZXZlbExvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBmaW5pc2hlcyAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgbG9hZGVkIGxldmVsLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfSB9XG4gIExFVkVMX0xPQURFRDogJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIOiAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORzogJ2hsc0ZyYWdMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgcHJvZ3Jlc3NpbmcgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHsgdHJlcXVlc3QsIHRmaXJzdCwgbG9hZGVkfX1cbiAgRlJBR19MT0FEX1BST0dSRVNTOiAnaGxzRnJhZ0xvYWRQcm9ncmVzcycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgYWJvcnRpbmcgZm9yIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAtIGRhdGE6IHtmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQ6ICdobHNGcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEOiAnaGxzRnJhZ0xvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDogJ2hsc0ZyYWdQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIG1vb2YvbWRhdCBoYXZlIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb2YgOiBtb29mIE1QNCBib3gsIG1kYXQgOiBtZGF0IE1QNCBib3h9XG4gIEZSQUdfUEFSU0lOR19EQVRBOiAnaGxzRnJhZ1BhcnNpbmdEYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBwYXJzaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHVuZGVmaW5lZFxuICBGUkFHX1BBUlNFRDogJ2hsc0ZyYWdQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHJlbXV4ZWQgTVA0IGJveGVzIGhhdmUgYWxsIGJlZW4gYXBwZW5kZWQgaW50byBTb3VyY2VCdWZmZXIgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgdHBhcnNlZCwgdGJ1ZmZlcmVkLCBsZW5ndGh9IH1cbiAgRlJBR19CVUZGRVJFRDogJ2hsc0ZyYWdCdWZmZXJlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgbWF0Y2hpbmcgd2l0aCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uIGlzIGNoYW5naW5nIC0gZGF0YSA6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCB9XG4gIEZSQUdfQ0hBTkdFRDogJ2hsc0ZyYWdDaGFuZ2VkJyxcbiAgICAvLyBJZGVudGlmaWVyIGZvciBhIEZQUyBkcm9wIGV2ZW50IC0gZGF0YToge2N1cmVudERyb3BwZWQsIGN1cnJlbnREZWNvZGVkLCB0b3RhbERyb3BwZWRGcmFtZXN9XG4gIEZQU19EUk9QOiAnaGxzRlBTRHJvcCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFuIGVycm9yIGV2ZW50IC0gZGF0YTogeyB0eXBlIDogZXJyb3IgdHlwZSwgZGV0YWlscyA6IGVycm9yIGRldGFpbHMsIGZhdGFsIDogaWYgdHJ1ZSwgaGxzLmpzIGNhbm5vdC93aWxsIG5vdCB0cnkgdG8gcmVjb3ZlciwgaWYgZmFsc2UsIGhscy5qcyB3aWxsIHRyeSB0byByZWNvdmVyLG90aGVyIGVycm9yIHNwZWNpZmljIGRhdGF9XG4gIEVSUk9SOiAnaGxzRXJyb3InXG59O1xuIiwiLyoqXG4gKiBITFMgaW50ZXJmYWNlXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IEV2ZW50IGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuL2Vycm9ycyc7XG5pbXBvcnQgU3RhdHNIYW5kbGVyIGZyb20gJy4vc3RhdHMnO1xuaW1wb3J0IG9ic2VydmVyIGZyb20gJy4vb2JzZXJ2ZXInO1xuaW1wb3J0IFBsYXlsaXN0TG9hZGVyIGZyb20gJy4vbG9hZGVyL3BsYXlsaXN0LWxvYWRlcic7XG5pbXBvcnQgRnJhZ21lbnRMb2FkZXIgZnJvbSAnLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbmltcG9ydCBCdWZmZXJDb250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlci9idWZmZXItY29udHJvbGxlcic7XG5pbXBvcnQgTGV2ZWxDb250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbi8vaW1wb3J0IEZQU0NvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL2Zwcy1jb250cm9sbGVyJztcbmltcG9ydCB7bG9nZ2VyLCBlbmFibGVMb2dzfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgWGhyTG9hZGVyIGZyb20gJy4vdXRpbHMveGhyLWxvYWRlcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIHdpbmRvdy5NZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50cygpIHtcbiAgICByZXR1cm4gRXZlbnQ7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yVHlwZXMoKSB7XG4gICAgcmV0dXJuIEVycm9yVHlwZXM7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yRGV0YWlscygpIHtcbiAgICByZXR1cm4gRXJyb3JEZXRhaWxzO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgIHZhciBjb25maWdEZWZhdWx0ID0ge1xuICAgICAgYXV0b1N0YXJ0TG9hZDogdHJ1ZSxcbiAgICAgIGRlYnVnOiBmYWxzZSxcbiAgICAgIG1heEJ1ZmZlckxlbmd0aDogMzAsXG4gICAgICBtYXhCdWZmZXJTaXplOiA2MCAqIDEwMDAgKiAxMDAwLFxuICAgICAgbWF4TWF4QnVmZmVyTGVuZ3RoOiA2MDAsXG4gICAgICBlbmFibGVXb3JrZXI6IHRydWUsXG4gICAgICBmcmFnTG9hZGluZ1RpbWVPdXQ6IDIwMDAwLFxuICAgICAgZnJhZ0xvYWRpbmdNYXhSZXRyeTogMSxcbiAgICAgIGZyYWdMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgIGZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDogMyxcbiAgICAgIG1hbmlmZXN0TG9hZGluZ1RpbWVPdXQ6IDEwMDAwLFxuICAgICAgbWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk6IDEsXG4gICAgICBtYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgZnBzRHJvcHBlZE1vbml0b3JpbmdQZXJpb2Q6IDUwMDAsXG4gICAgICBmcHNEcm9wcGVkTW9uaXRvcmluZ1RocmVzaG9sZDogMC4yLFxuICAgICAgYXBwZW5kRXJyb3JNYXhSZXRyeTogMjAwLFxuICAgICAgbG9hZGVyOiBYaHJMb2FkZXJcbiAgICB9O1xuICAgIGZvciAodmFyIHByb3AgaW4gY29uZmlnRGVmYXVsdCkge1xuICAgICAgICBpZiAocHJvcCBpbiBjb25maWcpIHsgY29udGludWU7IH1cbiAgICAgICAgY29uZmlnW3Byb3BdID0gY29uZmlnRGVmYXVsdFtwcm9wXTtcbiAgICB9XG4gICAgZW5hYmxlTG9ncyhjb25maWcuZGVidWcpO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBuZXcgUGxheWxpc3RMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlciA9IG5ldyBGcmFnbWVudExvYWRlcih0aGlzKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IG5ldyBMZXZlbENvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyID0gbmV3IEJ1ZmZlckNvbnRyb2xsZXIodGhpcyk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIgPSBuZXcgRlBTQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLnN0YXRzSGFuZGxlciA9IG5ldyBTdGF0c0hhbmRsZXIodGhpcyk7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5vZmYuYmluZChvYnNlcnZlcik7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGxvZ2dlci5sb2coJ2Rlc3Ryb3knKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5zdGF0c0hhbmRsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMudXJsID0gbnVsbDtcbiAgICB0aGlzLmRldGFjaFZpZGVvKCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hWaWRlbyh2aWRlbykge1xuICAgIGxvZ2dlci5sb2coJ2F0dGFjaFZpZGVvJyk7XG4gICAgdGhpcy52aWRlbyA9IHZpZGVvO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyLmF0dGFjaFZpZGVvKHZpZGVvKTtcbiAgICAvLyBzZXR1cCB0aGUgbWVkaWEgc291cmNlXG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIC8vTWVkaWEgU291cmNlIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc28gPSB0aGlzLm9uTWVkaWFTb3VyY2VPcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NZWRpYVNvdXJjZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zYyA9IHRoaXMub25NZWRpYVNvdXJjZUNsb3NlLmJpbmQodGhpcyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAvLyBsaW5rIHZpZGVvIGFuZCBtZWRpYSBTb3VyY2VcbiAgICB2aWRlby5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG1zKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub252ZXJyb3IpO1xuICB9XG5cbiAgZGV0YWNoVmlkZW8oKSB7XG4gICAgbG9nZ2VyLmxvZygnZGV0YWNoVmlkZW8nKTtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyLmRldGFjaFZpZGVvKHZpZGVvKTtcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmIChtcykge1xuICAgICAgaWYgKG1zLnJlYWR5U3RhdGUgIT09ICdlbmRlZCcpIHtcbiAgICAgICAgbXMuZW5kT2ZTdHJlYW0oKTtcbiAgICAgIH1cbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB2aWRlby5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgICAgbG9nZ2VyLmxvZygndHJpZ2dlciBNU0VfREVUQUNIRUQnKTtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTVNFX0RFVEFDSEVEKTtcbiAgICB9XG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25tc2UgPSB0aGlzLm9ubXNjID0gbnVsbDtcbiAgICBpZiAodmlkZW8pIHtcbiAgICAgIHRoaXMudmlkZW8gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRTb3VyY2UodXJsKSB7XG4gICAgbG9nZ2VyLmxvZyhgbG9hZFNvdXJjZToke3VybH1gKTtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICAvLyB3aGVuIGF0dGFjaGluZyB0byBhIHNvdXJjZSBVUkwsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkXG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FESU5HLCB7dXJsOiB1cmx9KTtcbiAgfVxuXG4gIHN0YXJ0TG9hZCgpIHtcbiAgICBsb2dnZXIubG9nKCdzdGFydExvYWQnKTtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIuc3RhcnRMb2FkKCk7XG4gIH1cblxuICByZWNvdmVyTWVkaWFFcnJvcigpIHtcbiAgICBsb2dnZXIubG9nKCdyZWNvdmVyTWVkaWFFcnJvcicpO1xuICAgIHZhciB2aWRlbyA9IHRoaXMudmlkZW87XG4gICAgdGhpcy5kZXRhY2hWaWRlbygpO1xuICAgIHRoaXMuYXR0YWNoVmlkZW8odmlkZW8pO1xuICB9XG5cbiAgLyoqIFJldHVybiBhbGwgcXVhbGl0eSBsZXZlbHMgKiovXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVscztcbiAgfVxuXG4gIC8qKiBSZXR1cm4gY3VycmVudCBwbGF5YmFjayBxdWFsaXR5IGxldmVsICoqL1xuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIuY3VycmVudExldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgaW1tZWRpYXRlbHkgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgY3VycmVudExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGN1cnJlbnRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubG9hZExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyLmltbWVkaWF0ZUxldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIG5leHQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAocXVhbGl0eSBsZXZlbCBvZiBuZXh0IGZyYWdtZW50KSAqKi9cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXJDb250cm9sbGVyLm5leHRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBuZXh0IGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IG5leHRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBuZXh0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgY3VycmVudC9sYXN0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IGxvYWRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgY3VycmVudC9uZXh0IGxvYWRlZCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBsb2FkTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgbG9hZExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBuZXh0TG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5uZXh0TG9hZExldmVsKCk7XG4gIH1cblxuICAvKiogc2V0IHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIHNldCBuZXh0TG9hZExldmVsKGxldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWwgPSBsZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gZmlyc3QgbGV2ZWwgKGluZGV4IG9mIGZpcnN0IGxldmVsIHJlZmVyZW5jZWQgaW4gbWFuaWZlc3QpXG4gICoqL1xuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuZmlyc3RMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgZmlyc3QgbGV2ZWwgKGluZGV4IG9mIGZpcnN0IGxldmVsIHJlZmVyZW5jZWQgaW4gbWFuaWZlc3QpXG4gICoqL1xuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBmaXJzdExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBzdGFydCBsZXZlbCAobGV2ZWwgb2YgZmlyc3QgZnJhZ21lbnQgdGhhdCB3aWxsIGJlIHBsYXllZCBiYWNrKVxuICAgICAgaWYgbm90IG92ZXJyaWRlZCBieSB1c2VyLCBmaXJzdCBsZXZlbCBhcHBlYXJpbmcgaW4gbWFuaWZlc3Qgd2lsbCBiZSB1c2VkIGFzIHN0YXJ0IGxldmVsXG4gICAgICBpZiAtMSA6IGF1dG9tYXRpYyBzdGFydCBsZXZlbCBzZWxlY3Rpb24sIHBsYXliYWNrIHdpbGwgc3RhcnQgZnJvbSBsZXZlbCBtYXRjaGluZyBkb3dubG9hZCBiYW5kd2lkdGggKGRldGVybWluZWQgZnJvbSBkb3dubG9hZCBvZiBmaXJzdCBzZWdtZW50KVxuICAqKi9cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0ICBzdGFydCBsZXZlbCAobGV2ZWwgb2YgZmlyc3QgZnJhZ21lbnQgdGhhdCB3aWxsIGJlIHBsYXllZCBiYWNrKVxuICAgICAgaWYgbm90IG92ZXJyaWRlZCBieSB1c2VyLCBmaXJzdCBsZXZlbCBhcHBlYXJpbmcgaW4gbWFuaWZlc3Qgd2lsbCBiZSB1c2VkIGFzIHN0YXJ0IGxldmVsXG4gICAgICBpZiAtMSA6IGF1dG9tYXRpYyBzdGFydCBsZXZlbCBzZWxlY3Rpb24sIHBsYXliYWNrIHdpbGwgc3RhcnQgZnJvbSBsZXZlbCBtYXRjaGluZyBkb3dubG9hZCBiYW5kd2lkdGggKGRldGVybWluZWQgZnJvbSBkb3dubG9hZCBvZiBmaXJzdCBzZWdtZW50KVxuICAqKi9cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgc3RhcnRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGF1dG9MZXZlbENhcHBpbmc6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiBjaGVjayBpZiB3ZSBhcmUgaW4gYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBtb2RlICovXG4gIGdldCBhdXRvTGV2ZWxFbmFibGVkKCkge1xuICAgIHJldHVybiAodGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPT09IC0xKTtcbiAgfVxuXG4gIC8qIHJldHVybiBtYW51YWwgbGV2ZWwgKi9cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbDtcbiAgfVxuXG4gIC8qIHJldHVybiBwbGF5YmFjayBzZXNzaW9uIHN0YXRzICovXG4gIGdldCBzdGF0cygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0c0hhbmRsZXIuc3RhdHM7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2Ugb3BlbmVkJyk7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NU0VfQVRUQUNIRUQsIHt2aWRlbzogdGhpcy52aWRlbywgbWVkaWFTb3VyY2U6IHRoaXMubWVkaWFTb3VyY2V9KTtcbiAgICAvLyBvbmNlIHJlY2VpdmVkLCBkb24ndCBsaXN0ZW4gYW55bW9yZSB0byBzb3VyY2VvcGVuIGV2ZW50XG4gICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlQ2xvc2UoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGNsb3NlZCcpO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBlbmRlZCcpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEhscztcbiIsIi8qXG4gKiBGcmFnbWVudCBMb2FkZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IG9ic2VydmVyIGZyb20gJy4uL29ic2VydmVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBGcmFnbWVudExvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FESU5HLCB0aGlzLm9uZmwpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfTE9BRElORywgdGhpcy5vbmZsKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgZnJhZyA9IGRhdGEuZnJhZztcbiAgICB0aGlzLmZyYWcgPSBmcmFnO1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSAwO1xuICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWc7XG4gICAgZnJhZy5sb2FkZXIgPSB0aGlzLmxvYWRlciA9IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LCBjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LCB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciBwYXlsb2FkID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZTtcbiAgICBzdGF0cy5sZW5ndGggPSBwYXlsb2FkLmJ5dGVMZW5ndGg7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICB0aGlzLmZyYWcubG9hZGVyID0gdW5kZWZpbmVkO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FERUQsIHtwYXlsb2FkOiBwYXlsb2FkLCBmcmFnOiB0aGlzLmZyYWcsIHN0YXRzOiBzdGF0c30pO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZywgcmVzcG9uc2U6IGV2ZW50fSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVCwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcyhldmVudCwgc3RhdHMpIHtcbiAgICB0aGlzLmZyYWcubG9hZGVkID0gc3RhdHMubG9hZGVkO1xuICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHtmcmFnOiB0aGlzLmZyYWcsIHN0YXRzOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLyoqXG4gKiBQbGF5bGlzdCBMb2FkZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IG9ic2VydmVyIGZyb20gJy4uL29ic2VydmVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuLy9pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgUGxheWxpc3RMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25tbCA9IHRoaXMub25NYW5pZmVzdExvYWRpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5MRVZFTF9MT0FESU5HLCB0aGlzLm9ubGwpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51cmwgPSB0aGlzLmlkID0gbnVsbDtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTEVWRUxfTE9BRElORywgdGhpcy5vbmxsKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKGV2ZW50LCBkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBudWxsKTtcbiAgfVxuXG4gIG9uTGV2ZWxMb2FkaW5nKGV2ZW50LCBkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBkYXRhLmxldmVsLCBkYXRhLmlkKTtcbiAgfVxuXG4gIGxvYWQodXJsLCBpZDEsIGlkMikge1xuICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWc7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5pZCA9IGlkMTtcbiAgICB0aGlzLmlkMiA9IGlkMjtcbiAgICB0aGlzLmxvYWRlciA9IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZCh1cmwsICcnLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLm1hbmlmZXN0TG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5tYW5pZmVzdExvYWRpbmdNYXhSZXRyeSwgY29uZmlnLm1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXkpO1xuICB9XG5cbiAgcmVzb2x2ZSh1cmwsIGJhc2VVcmwpIHtcbiAgICB2YXIgZG9jICAgICAgPSBkb2N1bWVudCxcbiAgICAgICAgb2xkQmFzZSA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYmFzZScpWzBdLFxuICAgICAgICBvbGRIcmVmID0gb2xkQmFzZSAmJiBvbGRCYXNlLmhyZWYsXG4gICAgICAgIGRvY0hlYWQgPSBkb2MuaGVhZCB8fCBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXSxcbiAgICAgICAgb3VyQmFzZSA9IG9sZEJhc2UgfHwgZG9jSGVhZC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnYmFzZScpKSxcbiAgICAgICAgcmVzb2x2ZXIgPSBkb2MuY3JlYXRlRWxlbWVudCgnYScpLFxuICAgICAgICByZXNvbHZlZFVybDtcbiAgICBvdXJCYXNlLmhyZWYgPSBiYXNlVXJsO1xuICAgIHJlc29sdmVyLmhyZWYgPSB1cmw7XG4gICAgcmVzb2x2ZWRVcmwgID0gcmVzb2x2ZXIuaHJlZjsgLy8gYnJvd3NlciBtYWdpYyBhdCB3b3JrIGhlcmVcbiAgICBpZiAob2xkQmFzZSkgeyBvbGRCYXNlLmhyZWYgPSBvbGRIcmVmOyB9XG4gICAgZWxzZSB7IGRvY0hlYWQucmVtb3ZlQ2hpbGQob3VyQmFzZSk7IH1cbiAgICByZXR1cm4gcmVzb2x2ZWRVcmw7XG4gIH1cblxuICBwYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgYmFzZXVybCkge1xuICAgIHZhciBsZXZlbHMgPSBbXSwgbGV2ZWwgPSAge30sIHJlc3VsdCwgY29kZWNzLCBjb2RlYztcbiAgICB2YXIgcmUgPSAvI0VYVC1YLVNUUkVBTS1JTkY6KFteXFxuXFxyXSooQkFORClXSURUSD0oXFxkKykpPyhbXlxcblxccl0qKENPREVDUyk9XFxcIiguKilcXFwiLCk/KFteXFxuXFxyXSooUkVTKU9MVVRJT049KFxcZCspeChcXGQrKSk/KFteXFxuXFxyXSooTkFNRSk9XFxcIiguKilcXFwiKT9bXlxcblxccl0qW1xcclxcbl0rKFteXFxyXFxuXSspL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4pIHsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpOyB9KTtcbiAgICAgIGxldmVsLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHQucG9wKCksIGJhc2V1cmwpO1xuICAgICAgd2hpbGUgKHJlc3VsdC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHN3aXRjaCAocmVzdWx0LnNoaWZ0KCkpIHtcbiAgICAgICAgICBjYXNlICdSRVMnOlxuICAgICAgICAgICAgbGV2ZWwud2lkdGggPSBwYXJzZUludChyZXN1bHQuc2hpZnQoKSk7XG4gICAgICAgICAgICBsZXZlbC5oZWlnaHQgPSBwYXJzZUludChyZXN1bHQuc2hpZnQoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdCQU5EJzpcbiAgICAgICAgICAgIGxldmVsLmJpdHJhdGUgPSBwYXJzZUludChyZXN1bHQuc2hpZnQoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdOQU1FJzpcbiAgICAgICAgICAgIGxldmVsLm5hbWUgPSByZXN1bHQuc2hpZnQoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0NPREVDUyc6XG4gICAgICAgICAgICBjb2RlY3MgPSByZXN1bHQuc2hpZnQoKS5zcGxpdCgnLCcpO1xuICAgICAgICAgICAgd2hpbGUgKGNvZGVjcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIGNvZGVjID0gY29kZWNzLnNoaWZ0KCk7XG4gICAgICAgICAgICAgIGlmIChjb2RlYy5pbmRleE9mKCdhdmMxJykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwudmlkZW9Db2RlYyA9IHRoaXMuYXZjMXRvYXZjb3RpKGNvZGVjKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXZlbC5hdWRpb0NvZGVjID0gY29kZWM7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgbGV2ZWwgPSB7fTtcbiAgICB9XG4gICAgcmV0dXJuIGxldmVscztcbiAgfVxuXG4gIGF2YzF0b2F2Y290aShjb2RlYykge1xuICAgIHZhciByZXN1bHQsIGF2Y2RhdGEgPSBjb2RlYy5zcGxpdCgnLicpO1xuICAgIGlmIChhdmNkYXRhLmxlbmd0aCA+IDIpIHtcbiAgICAgIHJlc3VsdCA9IGF2Y2RhdGEuc2hpZnQoKSArICcuJztcbiAgICAgIHJlc3VsdCArPSBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJlc3VsdCArPSAoJzAwJyArIHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBjb2RlYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwsIGlkKSB7XG4gICAgdmFyIGN1cnJlbnRTTiA9IDAsIHRvdGFsZHVyYXRpb24gPSAwLCBsZXZlbCA9IHt1cmw6IGJhc2V1cmwsIGZyYWdtZW50czogW10sIGxpdmU6IHRydWUsIHN0YXJ0U046IDB9LCByZXN1bHQsIHJlZ2V4cCwgY2MgPSAwO1xuICAgIHJlZ2V4cCA9IC8oPzojRVhULVgtKE1FRElBLVNFUVVFTkNFKTooXFxkKykpfCg/OiNFWFQtWC0oVEFSR0VURFVSQVRJT04pOihcXGQrKSl8KD86I0VYVChJTkYpOihbXFxkXFwuXSspW15cXHJcXG5dKltcXHJcXG5dKyhbXlxcclxcbl0rKXwoPzojRVhULVgtKEVORExJU1QpKXwoPzojRVhULVgtKERJUylDT05USU5VSVRZKSkvZztcbiAgICB3aGlsZSAoKHJlc3VsdCA9IHJlZ2V4cC5leGVjKHN0cmluZykpICE9PSBudWxsKSB7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obikgeyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7IH0pO1xuICAgICAgc3dpdGNoIChyZXN1bHRbMF0pIHtcbiAgICAgICAgY2FzZSAnTUVESUEtU0VRVUVOQ0UnOlxuICAgICAgICAgIGN1cnJlbnRTTiA9IGxldmVsLnN0YXJ0U04gPSBwYXJzZUludChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdUQVJHRVREVVJBVElPTic6XG4gICAgICAgICAgbGV2ZWwudGFyZ2V0ZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0VORExJU1QnOlxuICAgICAgICAgIGxldmVsLmxpdmUgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRElTJzpcbiAgICAgICAgICBjYysrO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdJTkYnOlxuICAgICAgICAgIHZhciBkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBsZXZlbC5mcmFnbWVudHMucHVzaCh7dXJsOiB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKSwgZHVyYXRpb246IGR1cmF0aW9uLCBzdGFydDogdG90YWxkdXJhdGlvbiwgc246IGN1cnJlbnRTTisrLCBsZXZlbDogaWQsIGNjOiBjY30pO1xuICAgICAgICAgIHRvdGFsZHVyYXRpb24gKz0gZHVyYXRpb247XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZm91bmQgJyArIGxldmVsLmZyYWdtZW50cy5sZW5ndGggKyAnIGZyYWdtZW50cycpO1xuICAgIGxldmVsLnRvdGFsZHVyYXRpb24gPSB0b3RhbGR1cmF0aW9uO1xuICAgIGxldmVsLmVuZFNOID0gY3VycmVudFNOIC0gMTtcbiAgICByZXR1cm4gbGV2ZWw7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgc3RyaW5nID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVRleHQsIHVybCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VVUkwsIGlkID0gdGhpcy5pZCwgaWQyID0gdGhpcy5pZDIsIGxldmVscztcbiAgICAvLyByZXNwb25zZVVSTCBub3Qgc3VwcG9ydGVkIG9uIHNvbWUgYnJvd3NlcnMgKGl0IGlzIHVzZWQgdG8gZGV0ZWN0IFVSTCByZWRpcmVjdGlvbilcbiAgICBpZiAodXJsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGZhbGxiYWNrIHRvIGluaXRpYWwgVVJMXG4gICAgICB1cmwgPSB0aGlzLnVybDtcbiAgICB9XG4gICAgc3RhdHMudGxvYWQgPSBuZXcgRGF0ZSgpO1xuICAgIHN0YXRzLm10aW1lID0gbmV3IERhdGUoZXZlbnQuY3VycmVudFRhcmdldC5nZXRSZXNwb25zZUhlYWRlcignTGFzdC1Nb2RpZmllZCcpKTtcbiAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCBsZXZlbCB3aWxsIGJlIHJlbG9hZGVkIGFmdGVyd2FyZHNcbiAgICAgICAgLy8gKHRoaXMgaXMgdG8gaGF2ZSBhIHVuaWZvcm0gbG9naWMgZm9yIDEgbGV2ZWwvbXVsdGlsZXZlbCBwbGF5bGlzdHMpXG4gICAgICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHtsZXZlbHM6IFt7dXJsOiB1cmx9XSwgdXJsOiB1cmwsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELCB7ZGV0YWlsczogdGhpcy5wYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCB1cmwsIGlkKSwgbGV2ZWw6IGlkLCBpZDogaWQyLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzID0gdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgdXJsKTtcbiAgICAgICAgLy8gbXVsdGkgbGV2ZWwgcGxheWxpc3QsIHBhcnNlIGxldmVsIGluZm9cbiAgICAgICAgaWYgKGxldmVscy5sZW5ndGgpIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogbGV2ZWxzLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IHVybCwgcmVhc29uOiAnbm8gbGV2ZWwgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IHVybCwgcmVhc29uOiAnbm8gRVhUTTNVIGRlbGltaXRlcid9KTtcbiAgICB9XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9FUlJPUjtcbiAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBkZXRhaWxzLCBmYXRhbDogZmF0YWwsIHVybDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIHJlc3BvbnNlOiBldmVudC5jdXJyZW50VGFyZ2V0LCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDtcbiAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgfVxuICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IGRldGFpbHMsIGZhdGFsOiBmYXRhbCwgdXJsOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgbGV2ZWw6IHRoaXMuaWQsIGlkOiB0aGlzLmlkMn0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBsYXlsaXN0TG9hZGVyO1xuIiwiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuXG5sZXQgb2JzZXJ2ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5cbm9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG59O1xuXG5vYnNlcnZlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCAuLi5kYXRhKSB7XG4gIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCAuLi5kYXRhKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IG9ic2VydmVyO1xuIiwiLyoqXG4gKiBHZW5lcmF0ZSBNUDQgQm94XG4qL1xuXG5jbGFzcyBNUDQge1xuICBzdGF0aWMgaW5pdCgpIHtcbiAgICBNUDQudHlwZXMgPSB7XG4gICAgICBhdmMxOiBbXSwgLy8gY29kaW5nbmFtZVxuICAgICAgYXZjQzogW10sXG4gICAgICBidHJ0OiBbXSxcbiAgICAgIGRpbmY6IFtdLFxuICAgICAgZHJlZjogW10sXG4gICAgICBlc2RzOiBbXSxcbiAgICAgIGZ0eXA6IFtdLFxuICAgICAgaGRscjogW10sXG4gICAgICBtZGF0OiBbXSxcbiAgICAgIG1kaGQ6IFtdLFxuICAgICAgbWRpYTogW10sXG4gICAgICBtZmhkOiBbXSxcbiAgICAgIG1pbmY6IFtdLFxuICAgICAgbW9vZjogW10sXG4gICAgICBtb292OiBbXSxcbiAgICAgIG1wNGE6IFtdLFxuICAgICAgbXZleDogW10sXG4gICAgICBtdmhkOiBbXSxcbiAgICAgIHNkdHA6IFtdLFxuICAgICAgc3RibDogW10sXG4gICAgICBzdGNvOiBbXSxcbiAgICAgIHN0c2M6IFtdLFxuICAgICAgc3RzZDogW10sXG4gICAgICBzdHN6OiBbXSxcbiAgICAgIHN0dHM6IFtdLFxuICAgICAgdGZkdDogW10sXG4gICAgICB0ZmhkOiBbXSxcbiAgICAgIHRyYWY6IFtdLFxuICAgICAgdHJhazogW10sXG4gICAgICB0cnVuOiBbXSxcbiAgICAgIHRyZXg6IFtdLFxuICAgICAgdGtoZDogW10sXG4gICAgICB2bWhkOiBbXSxcbiAgICAgIHNtaGQ6IFtdXG4gICAgfTtcblxuICAgIHZhciBpO1xuICAgIGZvciAoaSBpbiBNUDQudHlwZXMpIHtcbiAgICAgIGlmIChNUDQudHlwZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgTVA0LnR5cGVzW2ldID0gW1xuICAgICAgICAgIGkuY2hhckNvZGVBdCgwKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMSksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDIpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgzKVxuICAgICAgICBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIE1QNC5NQUpPUl9CUkFORCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICdpJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ3MnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnbycuY2hhckNvZGVBdCgwKSxcbiAgICAgICdtJy5jaGFyQ29kZUF0KDApXG4gICAgXSk7XG5cbiAgICBNUDQuQVZDMV9CUkFORCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICdhJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ3YnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnYycuY2hhckNvZGVBdCgwKSxcbiAgICAgICcxJy5jaGFyQ29kZUF0KDApXG4gICAgXSk7XG5cbiAgICBNUDQuTUlOT1JfVkVSU0lPTiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG5cbiAgICBNUDQuVklERU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LCAvLyBoYW5kbGVyX3R5cGU6ICd2aWRlJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgIDB4NmYsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdWaWRlb0hhbmRsZXInXG4gICAgXSk7XG5cbiAgICBNUDQuQVVESU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG5cbiAgICBNUDQuSERMUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6IE1QNC5WSURFT19IRExSLFxuICAgICAgJ2F1ZGlvJzogTVA0LkFVRElPX0hETFJcbiAgICB9O1xuXG4gICAgTVA0LkRSRUYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG4gICAgTVA0LlNUQ08gPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCAvLyBlbnRyeV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5TVFNDID0gTVA0LlNUQ087XG4gICAgTVA0LlNUVFMgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIE1QNC5NQUpPUl9CUkFORCwgTVA0Lk1JTk9SX1ZFUlNJT04sIE1QNC5NQUpPUl9CUkFORCwgTVA0LkFWQzFfQlJBTkQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgTVA0LkRSRUYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gMCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgcmVzdWx0LFxuICAgIHZpZXc7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSB0b3RhbCBzaXplIHdlIG5lZWQgdG8gYWxsb2NhdGVcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSArIDgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcocmVzdWx0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCwgcmVzdWx0LmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQodHlwZSwgNCk7XG4gICAgLy8gY29weSB0aGUgcGF5bG9hZCBpbnRvIHRoZSByZXN1bHRcbiAgICBmb3IgKGkgPSAwLCBzaXplID0gODsgaSA8IHBheWxvYWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdC5zZXQocGF5bG9hZFtpXSwgc2l6ZSk7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHN0YXRpYyBoZGxyKHR5cGUpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuaGRsciwgTVA0LkhETFJfVFlQRVNbdHlwZV0pO1xuICB9XG5cbiAgc3RhdGljIG1kYXQoZGF0YSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGF0LCBkYXRhKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGhkKHRpbWVzY2FsZSwgZHVyYXRpb24pIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMywgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICh0aW1lc2NhbGUgPj4gMjQpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgIHRpbWVzY2FsZSAmIDB4RkYsIC8vIHRpbWVzY2FsZVxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDU1LCAweGM0LCAvLyAndW5kJyBsYW5ndWFnZSAodW5kZXRlcm1pbmVkKVxuICAgICAgMHgwMCwgMHgwMFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGlhKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaWEsIE1QNC5tZGhkKHRyYWNrLnRpbWVzY2FsZSwgdHJhY2suZHVyYXRpb24pLCBNUDQuaGRscih0cmFjay50eXBlKSwgTVA0Lm1pbmYodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyBtZmhkKHNlcXVlbmNlTnVtYmVyKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1maGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDI0KSxcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAxNikgJiAweEZGLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+ICA4KSAmIDB4RkYsXG4gICAgICBzZXF1ZW5jZU51bWJlciAmIDB4RkYsIC8vIHNlcXVlbmNlX251bWJlclxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtaW5mKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy5zbWhkLCBNUDQuU01IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMudm1oZCwgTVA0LlZNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgbW9vZihzbiwgYmFzZU1lZGlhRGVjb2RlVGltZSwgdHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubW9vZiwgTVA0Lm1maGQoc24pLCBNUDQudHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSk7XG4gIH1cbi8qKlxuICogQHBhcmFtIHRyYWNrcy4uLiAob3B0aW9uYWwpIHthcnJheX0gdGhlIHRyYWNrcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBtb3ZpZVxuICovXG4gIHN0YXRpYyBtb292KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJhayh0cmFja3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubW9vdiwgTVA0Lm12aGQodHJhY2tzWzBdLnRpbWVzY2FsZSwgdHJhY2tzWzBdLmR1cmF0aW9uKV0uY29uY2F0KGJveGVzKS5jb25jYXQoTVA0Lm12ZXgodHJhY2tzKSkpO1xuICB9XG5cbiAgc3RhdGljIG12ZXgodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmV4KHRyYWNrc1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubXZleF0uY29uY2F0KGJveGVzKSk7XG4gIH1cblxuICBzdGF0aWMgbXZoZCh0aW1lc2NhbGUsZHVyYXRpb24pIHtcbiAgICB2YXJcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgICAgKGR1cmF0aW9uID4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLCAvLyAxLjAgcmF0ZVxuICAgICAgICAweDAxLCAweDAwLCAvLyAxLjAgdm9sdW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHhmZiwgMHhmZiwgMHhmZiwgMHhmZiAvLyBuZXh0X3RyYWNrX0lEXG4gICAgICBdKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXZoZCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHNkdHAodHJhY2spIHtcbiAgICB2YXJcbiAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheSg0ICsgc2FtcGxlcy5sZW5ndGgpLFxuICAgICAgZmxhZ3MsXG4gICAgICBpO1xuICAgIC8vIGxlYXZlIHRoZSBmdWxsIGJveCBoZWFkZXIgKDQgYnl0ZXMpIGFsbCB6ZXJvXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGFncyA9IHNhbXBsZXNbaV0uZmxhZ3M7XG4gICAgICBieXRlc1tpICsgNF0gPSAoZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc2R0cCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHN0YmwodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RibCwgTVA0LnN0c2QodHJhY2spLCBNUDQuYm94KE1QNC50eXBlcy5zdHRzLCBNUDQuU1RUUyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c2MsIE1QNC5TVFNDKSwgTVA0LmJveChNUDQudHlwZXMuc3RzeiwgTVA0LlNUU1opLCBNUDQuYm94KE1QNC50eXBlcy5zdGNvLCBNUDQuU1RDTykpO1xuICB9XG5cbiAgc3RhdGljIGF2YzEodHJhY2spIHtcbiAgICB2YXIgc3BzID0gW10sIHBwcyA9IFtdLCBpO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnNwcy5sZW5ndGg7IGkrKykge1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoID4+PiA4KSAmIDB4RkYpO1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpOyAvLyBzZXF1ZW5jZVBhcmFtZXRlclNldExlbmd0aFxuICAgICAgc3BzID0gc3BzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5zcHNbaV0pKTsgLy8gU1BTXG4gICAgfVxuICAgIC8vIGFzc2VtYmxlIHRoZSBQUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnBwcy5sZW5ndGg7IGkrKykge1xuICAgICAgcHBzLnB1c2goKHRyYWNrLnBwc1tpXS5ieXRlTGVuZ3RoID4+PiA4KSAmIDB4RkYpO1xuICAgICAgcHBzLnB1c2goKHRyYWNrLnBwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpO1xuICAgICAgcHBzID0gcHBzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5wcHNbaV0pKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmF2YzEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgKHRyYWNrLndpZHRoID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2sud2lkdGggJiAweGZmLCAvLyB3aWR0aFxuICAgICAgICAodHJhY2suaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2suaGVpZ2h0ICYgMHhmZiwgLy8gaGVpZ2h0XG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIGhvcml6cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyB2ZXJ0cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBmcmFtZV9jb3VudFxuICAgICAgICAweDEzLFxuICAgICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgICAweDZmLCAweDZhLCAweDczLCAweDJkLFxuICAgICAgICAweDYzLCAweDZmLCAweDZlLCAweDc0LFxuICAgICAgICAweDcyLCAweDY5LCAweDYyLCAweDJkLFxuICAgICAgICAweDY4LCAweDZjLCAweDczLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBjb21wcmVzc29ybmFtZVxuICAgICAgICAweDAwLCAweDE4LCAvLyBkZXB0aCA9IDI0XG4gICAgICAgIDB4MTEsIDB4MTFdKSwgLy8gcHJlX2RlZmluZWQgPSAtMVxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmF2Y0MsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDEsIC8vIGNvbmZpZ3VyYXRpb25WZXJzaW9uXG4gICAgICAgICAgICB0cmFjay5wcm9maWxlSWRjLCAvLyBBVkNQcm9maWxlSW5kaWNhdGlvblxuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUNvbXBhdCwgLy8gcHJvZmlsZV9jb21wYXRpYmlsaXR5XG4gICAgICAgICAgICB0cmFjay5sZXZlbElkYywgLy8gQVZDTGV2ZWxJbmRpY2F0aW9uXG4gICAgICAgICAgICAweGZmIC8vIGxlbmd0aFNpemVNaW51c09uZSwgaGFyZC1jb2RlZCB0byA0IGJ5dGVzXG4gICAgICAgICAgXS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2suc3BzLmxlbmd0aCAvLyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChzcHMpLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5wcHMubGVuZ3RoIC8vIG51bU9mUGljdHVyZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQocHBzKSkpLCAvLyBcIlBQU1wiXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrdHJhY2suY29uZmlnLmxlbmd0aCwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK3RyYWNrLmNvbmZpZy5sZW5ndGgsIC8vIGxlbmd0aFxuICAgICAgMHg0MCwgLy9jb2RlYyA6IG1wZWc0X2F1ZGlvXG4gICAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYnVmZmVyX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1heEJpdHJhdGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgICAgMHgwNSAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIF0uY29uY2F0KFt0cmFjay5jb25maWcubGVuZ3RoXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgICAgKHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5tcDRhKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCwgTVA0LmF2YzEodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdGtoZCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50a2hkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDcsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRyYWNrLmlkID4+IDI0KSAmIDB4RkYsXG4gICAgICAodHJhY2suaWQgPj4gMTYpICYgMHhGRixcbiAgICAgICh0cmFjay5pZCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5pZCAmIDB4RkYsIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+IDI0KSxcbiAgICAgICh0cmFjay5kdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5kdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgICAweDAwLCAweDAwLCAvLyBhbHRlcm5hdGVfZ3JvdXBcbiAgICAgIDB4MDAsIDB4MDAsIC8vIG5vbi1hdWRpbyB0cmFjayB2b2x1bWVcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICh0cmFjay53aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay53aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKHRyYWNrLmhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5oZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAyNCksXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4yNCksXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLCBNUDQudGtoZCh0cmFjayksIE1QNC5tZGlhKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgdHJleCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmV4LCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICh0cmFjay5pZCA+PiAyNCksXG4gICAgICh0cmFjay5pZCA+PiAxNikgJiAwWEZGLFxuICAgICAodHJhY2suaWQgPj4gOCkgJiAwWEZGLFxuICAgICAodHJhY2suaWQgJiAweEZGKSwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9kdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cnVuKHRyYWNrLCBvZmZzZXQpIHtcbiAgICB2YXIgc2FtcGxlcywgc2FtcGxlLCBpLCBhcnJheTtcbiAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXTtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KDEyICsgKDE2ICogc2FtcGxlcy5sZW5ndGgpKTtcbiAgICBvZmZzZXQgKz0gOCArIGFycmF5LmJ5dGVMZW5ndGg7XG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gOCkgJiAweEZGLFxuICAgICAgc2FtcGxlcy5sZW5ndGggJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF0sMCk7XG4gICAgZm9yIChpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNhbXBsZSA9IHNhbXBsZXNbaV07XG4gICAgICBhcnJheS5zZXQoW1xuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5kdXJhdGlvbiAmIDB4RkYsIC8vIHNhbXBsZV9kdXJhdGlvblxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5zaXplICYgMHhGRiwgLy8gc2FtcGxlX3NpemVcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0xlYWRpbmcgPDwgMikgfCBzYW1wbGUuZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgICAoc2FtcGxlLmZsYWdzLmlzRGVwZW5kZWRPbiA8PCA2KSB8XG4gICAgICAgICAgKHNhbXBsZS5mbGFncy5oYXNSZWR1bmRhbmN5IDw8IDQpIHxcbiAgICAgICAgICAoc2FtcGxlLmZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgICAgc2FtcGxlLmZsYWdzLmlzTm9uU3luYyxcbiAgICAgICAgc2FtcGxlLmZsYWdzLmRlZ3JhZFByaW8gJiAweEYwIDw8IDgsXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRQcmlvICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAgIChzYW1wbGUuY3RzID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmN0cyA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5jdHMgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLmN0cyAmIDB4RkYgLy8gc2FtcGxlX2NvbXBvc2l0aW9uX3RpbWVfb2Zmc2V0XG4gICAgICBdLDEyKzE2KmkpO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJ1biwgYXJyYXkpO1xuICB9XG5cbiAgc3RhdGljIGluaXRTZWdtZW50KHRyYWNrcykge1xuICAgIGlmICghTVA0LnR5cGVzKSB7XG4gICAgICBNUDQuaW5pdCgpO1xuICAgIH1cbiAgICB2YXIgbW92aWUgPSBNUDQubW9vdih0cmFja3MpLCByZXN1bHQ7XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoTVA0LkZUWVAuYnl0ZUxlbmd0aCArIG1vdmllLmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQoTVA0LkZUWVApO1xuICAgIHJlc3VsdC5zZXQobW92aWUsIE1QNC5GVFlQLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuIiwiLyoqXG4gKiBTdGF0cyBoYW5kbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi9ldmVudHMnO1xuaW1wb3J0IG9ic2VydmVyIGZyb20gJy4vb2JzZXJ2ZXInO1xuXG5jbGFzcyBTdGF0c0hhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25tcCA9IHRoaXMub25NYW5pZmVzdFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mYyA9IHRoaXMub25GcmFnbWVudENoYW5nZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmIgPSB0aGlzLm9uRnJhZ21lbnRCdWZmZXJlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbGVhID0gdGhpcy5vbkZyYWdtZW50TG9hZEVtZXJnZW5jeUFib3J0ZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZXJyID0gdGhpcy5vbkVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwc2QgPSB0aGlzLm9uRlBTRHJvcC5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0JVRkZFUkVELCB0aGlzLm9uZmIpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfQ0hBTkdFRCwgdGhpcy5vbmZjKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB0aGlzLm9uZmxlYSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlBTX0RST1AsIHRoaXMub25mcHNkKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19CVUZGRVJFRCwgdGhpcy5vbmZiKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19DSEFOR0VELCB0aGlzLm9uZmMpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCwgdGhpcy5vbmZsZWEpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUFNfRFJPUCwgdGhpcy5vbmZwc2QpO1xuICB9XG5cbiAgYXR0YWNoVmlkZW8odmlkZW8pIHtcbiAgICB0aGlzLnZpZGVvID0gdmlkZW87XG4gIH1cblxuICBkZXRhY2hWaWRlbygpIHtcbiAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgfVxuXG4gIC8vIHJlc2V0IHN0YXRzIG9uIG1hbmlmZXN0IHBhcnNlZFxuICBvbk1hbmlmZXN0UGFyc2VkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLl9zdGF0cyA9IHt0ZWNoIDogJ2hscy5qcycsIGxldmVsTmI6IGRhdGEubGV2ZWxzLmxlbmd0aH07XG4gIH1cblxuICAvLyBvbiBmcmFnbWVudCBjaGFuZ2VkIGlzIHRyaWdnZXJlZCB3aGVuZXZlciBwbGF5YmFjayBvZiBhIG5ldyBmcmFnbWVudCBpcyBzdGFydGluZyAuLi5cbiAgb25GcmFnbWVudENoYW5nZWQoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLl9zdGF0cywgbGV2ZWwgPSBkYXRhLmZyYWcubGV2ZWwsIGF1dG9MZXZlbCA9IGRhdGEuZnJhZy5hdXRvTGV2ZWw7XG4gICAgaWYgKHN0YXRzKSB7XG4gICAgICBpZiAoc3RhdHMubGV2ZWxTdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHN0YXRzLmxldmVsU3RhcnQgPSBsZXZlbDtcbiAgICAgIH1cbiAgICAgIGlmIChhdXRvTGV2ZWwpIHtcbiAgICAgICAgaWYgKHN0YXRzLmZyYWdDaGFuZ2VkQXV0bykge1xuICAgICAgICAgIHN0YXRzLmF1dG9MZXZlbE1pbiA9IE1hdGgubWluKHN0YXRzLmF1dG9MZXZlbE1pbiwgbGV2ZWwpO1xuICAgICAgICAgIHN0YXRzLmF1dG9MZXZlbE1heCA9IE1hdGgubWF4KHN0YXRzLmF1dG9MZXZlbE1heCwgbGV2ZWwpO1xuICAgICAgICAgIHN0YXRzLmZyYWdDaGFuZ2VkQXV0bysrO1xuICAgICAgICAgIGlmICh0aGlzLmxldmVsTGFzdEF1dG8gJiYgbGV2ZWwgIT09IHN0YXRzLmF1dG9MZXZlbExhc3QpIHtcbiAgICAgICAgICAgIHN0YXRzLmF1dG9MZXZlbFN3aXRjaCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdGF0cy5hdXRvTGV2ZWxNaW4gPSBzdGF0cy5hdXRvTGV2ZWxNYXggPSBsZXZlbDtcbiAgICAgICAgICBzdGF0cy5hdXRvTGV2ZWxTd2l0Y2ggPSAwO1xuICAgICAgICAgIHN0YXRzLmZyYWdDaGFuZ2VkQXV0byA9IDE7XG4gICAgICAgICAgdGhpcy5zdW1BdXRvTGV2ZWwgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3VtQXV0b0xldmVsICs9IGxldmVsO1xuICAgICAgICBzdGF0cy5hdXRvTGV2ZWxBdmcgPSBNYXRoLnJvdW5kKDEwMDAgKiB0aGlzLnN1bUF1dG9MZXZlbCAvIHN0YXRzLmZyYWdDaGFuZ2VkQXV0bykgLyAxMDAwO1xuICAgICAgICBzdGF0cy5hdXRvTGV2ZWxMYXN0ID0gbGV2ZWw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoc3RhdHMuZnJhZ0NoYW5nZWRNYW51YWwpIHtcbiAgICAgICAgICBzdGF0cy5tYW51YWxMZXZlbE1pbiA9IE1hdGgubWluKHN0YXRzLm1hbnVhbExldmVsTWluLCBsZXZlbCk7XG4gICAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxNYXggPSBNYXRoLm1heChzdGF0cy5tYW51YWxMZXZlbE1heCwgbGV2ZWwpO1xuICAgICAgICAgIHN0YXRzLmZyYWdDaGFuZ2VkTWFudWFsKys7XG4gICAgICAgICAgaWYgKCF0aGlzLmxldmVsTGFzdEF1dG8gJiYgbGV2ZWwgIT09IHN0YXRzLm1hbnVhbExldmVsTGFzdCkge1xuICAgICAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxTd2l0Y2grKztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxNaW4gPSBzdGF0cy5tYW51YWxMZXZlbE1heCA9IGxldmVsO1xuICAgICAgICAgIHN0YXRzLm1hbnVhbExldmVsU3dpdGNoID0gMDtcbiAgICAgICAgICBzdGF0cy5mcmFnQ2hhbmdlZE1hbnVhbCA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxMYXN0ID0gbGV2ZWw7XG4gICAgICB9XG4gICAgICB0aGlzLmxldmVsTGFzdEF1dG8gPSBhdXRvTGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgLy8gdHJpZ2dlcmVkIGVhY2ggdGltZSBhIG5ldyBmcmFnbWVudCBpcyBidWZmZXJlZFxuICBvbkZyYWdtZW50QnVmZmVyZWQoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLl9zdGF0cyxsYXRlbmN5ID0gZGF0YS5zdGF0cy50Zmlyc3QgLSBkYXRhLnN0YXRzLnRyZXF1ZXN0LCBwcm9jZXNzID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgLSBkYXRhLnN0YXRzLnRyZXF1ZXN0LCBiaXRyYXRlID0gTWF0aC5yb3VuZCg4ICogZGF0YS5zdGF0cy5sZW5ndGggLyAoZGF0YS5zdGF0cy50YnVmZmVyZWQgLSBkYXRhLnN0YXRzLnRmaXJzdCkpO1xuICAgIGlmIChzdGF0cy5mcmFnQnVmZmVyZWQpIHtcbiAgICAgIHN0YXRzLmZyYWdNaW5MYXRlbmN5ID0gTWF0aC5taW4oc3RhdHMuZnJhZ01pbkxhdGVuY3ksIGxhdGVuY3kpO1xuICAgICAgc3RhdHMuZnJhZ01heExhdGVuY3kgPSBNYXRoLm1heChzdGF0cy5mcmFnTWF4TGF0ZW5jeSwgbGF0ZW5jeSk7XG4gICAgICBzdGF0cy5mcmFnTWluUHJvY2VzcyA9IE1hdGgubWluKHN0YXRzLmZyYWdNaW5Qcm9jZXNzLCBwcm9jZXNzKTtcbiAgICAgIHN0YXRzLmZyYWdNYXhQcm9jZXNzID0gTWF0aC5tYXgoc3RhdHMuZnJhZ01heFByb2Nlc3MsIHByb2Nlc3MpO1xuICAgICAgc3RhdHMuZnJhZ01pbkticHMgPSBNYXRoLm1pbihzdGF0cy5mcmFnTWluS2JwcywgYml0cmF0ZSk7XG4gICAgICBzdGF0cy5mcmFnTWF4S2JwcyA9IE1hdGgubWF4KHN0YXRzLmZyYWdNYXhLYnBzLCBiaXRyYXRlKTtcbiAgICAgIHN0YXRzLmF1dG9MZXZlbENhcHBpbmdNaW4gPSBNYXRoLm1pbihzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWluLCB0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nKTtcbiAgICAgIHN0YXRzLmF1dG9MZXZlbENhcHBpbmdNYXggPSBNYXRoLm1heChzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWF4LCB0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nKTtcbiAgICAgIHN0YXRzLmZyYWdCdWZmZXJlZCsrO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0cy5mcmFnTWluTGF0ZW5jeSA9IHN0YXRzLmZyYWdNYXhMYXRlbmN5ID0gbGF0ZW5jeTtcbiAgICAgIHN0YXRzLmZyYWdNaW5Qcm9jZXNzID0gc3RhdHMuZnJhZ01heFByb2Nlc3MgPSBwcm9jZXNzO1xuICAgICAgc3RhdHMuZnJhZ01pbkticHMgPSBzdGF0cy5mcmFnTWF4S2JwcyA9IGJpdHJhdGU7XG4gICAgICBzdGF0cy5mcmFnQnVmZmVyZWQgPSAxO1xuICAgICAgc3RhdHMuZnJhZ0J1ZmZlcmVkQnl0ZXMgPSAwO1xuICAgICAgc3RhdHMuYXV0b0xldmVsQ2FwcGluZ01pbiA9IHN0YXRzLmF1dG9MZXZlbENhcHBpbmdNYXggPSB0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nO1xuICAgICAgdGhpcy5zdW1MYXRlbmN5ID0gMDtcbiAgICAgIHRoaXMuc3VtS2JwcyA9IDA7XG4gICAgICB0aGlzLnN1bVByb2Nlc3MgPSAwO1xuICAgIH1cbiAgICBzdGF0cy5mcmFnbGFzdExhdGVuY3kgPSBsYXRlbmN5O1xuICAgIHRoaXMuc3VtTGF0ZW5jeSArPSBsYXRlbmN5O1xuICAgIHN0YXRzLmZyYWdBdmdMYXRlbmN5ID0gTWF0aC5yb3VuZCh0aGlzLnN1bUxhdGVuY3kgLyBzdGF0cy5mcmFnQnVmZmVyZWQpO1xuICAgIHN0YXRzLmZyYWdMYXN0UHJvY2VzcyA9IHByb2Nlc3M7XG4gICAgdGhpcy5zdW1Qcm9jZXNzICs9IHByb2Nlc3M7XG4gICAgc3RhdHMuZnJhZ0F2Z1Byb2Nlc3MgPSBNYXRoLnJvdW5kKHRoaXMuc3VtUHJvY2VzcyAvIHN0YXRzLmZyYWdCdWZmZXJlZCk7XG4gICAgc3RhdHMuZnJhZ0xhc3RLYnBzID0gYml0cmF0ZTtcbiAgICB0aGlzLnN1bUticHMgKz0gYml0cmF0ZTtcbiAgICBzdGF0cy5mcmFnQXZnS2JwcyA9IE1hdGgucm91bmQodGhpcy5zdW1LYnBzIC8gc3RhdHMuZnJhZ0J1ZmZlcmVkKTtcbiAgICBzdGF0cy5mcmFnQnVmZmVyZWRCeXRlcyArPSBkYXRhLnN0YXRzLmxlbmd0aDtcbiAgICBzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTGFzdCA9IHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZEVtZXJnZW5jeUFib3J0ZWQoKSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5fc3RhdHM7XG4gICAgaWYgKHN0YXRzKSB7XG4gICAgICBpZiAoc3RhdHMuZnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RhdHMuZnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkID0gMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXRzLmZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRXJyb3IoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLl9zdGF0cztcbiAgICBpZiAoc3RhdHMpIHtcbiAgICAgIC8vIHRyYWNrIGFsbCBlcnJvcnMgaW5kZXBlbmRlbnRseVxuICAgICAgaWYgKHN0YXRzW2RhdGEuZGV0YWlsc10gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzdGF0c1tkYXRhLmRldGFpbHNdID0gMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXRzW2RhdGEuZGV0YWlsc10gKz0gMTtcbiAgICAgIH1cbiAgICAgIC8vIHRyYWNrIGZhdGFsIGVycm9yXG4gICAgICBpZiAoZGF0YS5mYXRhbCkge1xuICAgICAgICBpZiAoc3RhdHMuZmF0YWxFcnJvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc3RhdHMuZmF0YWxFcnJvciA9IDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0cy5mYXRhbEVycm9yICs9IDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkZQU0Ryb3AoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLl9zdGF0cztcbiAgICBpZiAoc3RhdHMpIHtcbiAgICAgaWYgKHN0YXRzLmZwc0Ryb3BFdmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHN0YXRzLmZwc0Ryb3BFdmVudCA9IDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGF0cy5mcHNEcm9wRXZlbnQrKztcbiAgICAgIH1cbiAgICAgIHN0YXRzLmZwc1RvdGFsRHJvcHBlZEZyYW1lcyA9IGRhdGEudG90YWxEcm9wcGVkRnJhbWVzO1xuICAgIH1cbiAgfVxuXG4gIGdldCBzdGF0cygpIHtcbiAgICBpZiAodGhpcy52aWRlbykge1xuICAgICAgdGhpcy5fc3RhdHMubGFzdFBvcyA9IHRoaXMudmlkZW8uY3VycmVudFRpbWUudG9GaXhlZCgzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0YXRzO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0YXRzSGFuZGxlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbmxldCBmYWtlTG9nZ2VyID0ge1xuICBsb2c6IG5vb3AsXG4gIHdhcm46IG5vb3AsXG4gIGluZm86IG5vb3AsXG4gIGVycm9yOiBub29wXG59O1xuXG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Zykge1xuICBpZiAoZGVidWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyA9IGRlYnVnLmxvZyA/IGRlYnVnLmxvZy5iaW5kKGRlYnVnKSA6IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyA9IGRlYnVnLmluZm8gPyBkZWJ1Zy5pbmZvLmJpbmQoZGVidWcpIDogY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBkZWJ1Zy5lcnJvciA/IGRlYnVnLmVycm9yLmJpbmQoZGVidWcpIDogY29uc29sZS5lcnJvci5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gPSBkZWJ1Zy53YXJuID8gZGVidWcud2Fybi5iaW5kKGRlYnVnKSA6IGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpO1xuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG9uJ3QgYWxsb3cgdG8gdXNlIGJpbmQgb24gY29uc29sZSBvYmplY3QgYW55d2F5XG4gICAgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICBleHBvcnRlZExvZ2dlci5sb2coKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci5pbmZvID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmVycm9yID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gPSBub29wO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5cbmV4cG9ydCB2YXIgbG9nZ2VyID0gZXhwb3J0ZWRMb2dnZXI7XG4iLCIvKipcbiAqIFhIUiBiYXNlZCBsb2dnZXJcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgY29uZmlnLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwID0gY29uZmlnLnhoclNldHVwO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIGlmICh0aGlzLmxvYWRlciAmJiB0aGlzLmxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnN0YXRzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGltZW91dEhhbmRsZSkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQodXJsLCByZXNwb25zZVR5cGUsIG9uU3VjY2Vzcywgb25FcnJvciwgb25UaW1lb3V0LCB0aW1lb3V0LCBtYXhSZXRyeSwgcmV0cnlEZWxheSwgb25Qcm9ncmVzcyA9IG51bGwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLm9uU3VjY2VzcyA9IG9uU3VjY2VzcztcbiAgICB0aGlzLm9uUHJvZ3Jlc3MgPSBvblByb2dyZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy5zdGF0cyA9IHt0cmVxdWVzdDogbmV3IERhdGUoKSwgcmV0cnk6IDB9O1xuICAgIHRoaXMudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgdGhpcy5tYXhSZXRyeSA9IG1heFJldHJ5O1xuICAgIHRoaXMucmV0cnlEZWxheSA9IHJldHJ5RGVsYXk7XG4gICAgdGhpcy50aW1lb3V0SGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aW1lb3V0KTtcbiAgICB0aGlzLmxvYWRJbnRlcm5hbCgpO1xuICB9XG5cbiAgbG9hZEludGVybmFsKCkge1xuICAgIHZhciB4aHIgPSB0aGlzLmxvYWRlciA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhoci5vbmxvYWQgPSAgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vbmVycm9yID0gdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIHRoaXMudXJsLCB0cnVlKTtcbiAgICB4aHIucmVzcG9uc2VUeXBlID0gdGhpcy5yZXNwb25zZVR5cGU7XG4gICAgdGhpcy5zdGF0cy50Zmlyc3QgPSBudWxsO1xuICAgIHRoaXMuc3RhdHMubG9hZGVkID0gMDtcbiAgICBpZiAodGhpcy54aHJTZXR1cCkge1xuICAgICAgdGhpcy54aHJTZXR1cCh4aHIpO1xuICAgIH1cbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQpIHtcbiAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgdGhpcy5zdGF0cy50bG9hZCA9IG5ldyBEYXRlKCk7XG4gICAgdGhpcy5vblN1Y2Nlc3MoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgaWYgKHRoaXMuc3RhdHMucmV0cnkgPCB0aGlzLm1heFJldHJ5KSB7XG4gICAgICBsb2dnZXIud2FybihgJHtldmVudC50eXBlfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9LCByZXRyeWluZyBpbiAke3RoaXMucmV0cnlEZWxheX0uLi5gKTtcbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkSW50ZXJuYWwuYmluZCh0aGlzKSwgdGhpcy5yZXRyeURlbGF5KTtcbiAgICAgIC8vIGV4cG9uZW50aWFsIGJhY2tvZmZcbiAgICAgIHRoaXMucmV0cnlEZWxheSA9IE1hdGgubWluKDIgKiB0aGlzLnJldHJ5RGVsYXksIDY0MDAwKTtcbiAgICAgIHRoaXMuc3RhdHMucmV0cnkrKztcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgICAgbG9nZ2VyLmVycm9yKGAke2V2ZW50LnR5cGV9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgICB0aGlzLm9uRXJyb3IoZXZlbnQpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWR0aW1lb3V0KGV2ZW50KSB7XG4gICAgbG9nZ2VyLndhcm4oYHRpbWVvdXQgd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfWAgKTtcbiAgICB0aGlzLm9uVGltZW91dChldmVudCwgdGhpcy5zdGF0cyk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgIGlmIChzdGF0cy50Zmlyc3QgPT09IG51bGwpIHtcbiAgICAgIHN0YXRzLnRmaXJzdCA9IG5ldyBEYXRlKCk7XG4gICAgfVxuICAgIHN0YXRzLmxvYWRlZCA9IGV2ZW50LmxvYWRlZDtcbiAgICBpZiAodGhpcy5vblByb2dyZXNzKSB7XG4gICAgICB0aGlzLm9uUHJvZ3Jlc3MoZXZlbnQsIHN0YXRzKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgWGhyTG9hZGVyO1xuIl19
