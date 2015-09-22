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
 * buffer controller
 *
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
          _utilsLogger.logger.log('resuming video @ ' + this.lastCurrentTime);
          this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
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
                //logger.log(`level/sn/sliding/drift/start/end/bufEnd:${level}/${frag.sn}/${sliding.toFixed(3)}/${drift.toFixed(3)}/${start.toFixed(3)}/${(start+frag.duration).toFixed(3)}/${bufferEnd.toFixed(3)}`);
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
            _utilsLogger.logger.log('Loading       ' + _frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level + ', currentTime:' + pos + ',bufferEnd:' + bufferEnd.toFixed(3));
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
                  //logger.log(`appending ${segment.type} SB, size:${segment.data.length}`);
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
          if (level && level.details && !level.details.live && this.video.duration - currentTime < 0.2) {
            if (this.mediaSource && this.mediaSource.readyState === 'open') {
              _utilsLogger.logger.log('end of VoD stream reached, signal endOfStream() to MediaSource');
              this.lastCurrentTime = this.startPosition;
              this.video = null;
              this.mediaSource.endOfStream();
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
      this.video.addEventListener('seeking', this.onvseeking);
      this.video.addEventListener('seeked', this.onvseeked);
      this.video.addEventListener('loadedmetadata', this.onvmetadata);
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
          _utilsLogger.logger.log('Demuxing      ' + this.frag.sn + ' of [' + details.startSN + ' ,' + details.endSN + '],level ' + this.level);
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
            //logger.log(`live playlist sliding:${level.details.sliding.toFixed(3)}`);
          }
        }
        _utilsLogger.logger.log('      parsed data, type/startPTS/endPTS/startDTS/endDTS/nb:' + data.type + '/' + data.startPTS.toFixed(3) + '/' + data.endPTS.toFixed(3) + '/' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '/' + data.nb);
        //this.frag.drift=data.startPTS-this.frag.start;
        this.frag.drift = 0;
        // if(level.details.sliding) {
        //   this.frag.drift-=level.details.sliding;
        // }
        //logger.log(`      drift:${this.frag.drift.toFixed(3)}`);
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
 * level controller
 *
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
      _observer2['default'].trigger(_events2['default'].MANIFEST_PARSED, { levels: this._levels,
        firstLevel: this._firstLevel,
        stats: data.stats
      });
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
        //console.log(`fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}/${stats.aborted}`);
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
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding
 * scheme used by h264.
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

// import Hex             from '../utils/hex';

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
                  //logger.log(`PTS looping ??? AVC PTS delta:${expectedPTS-ptsnorm}`);
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
        //console.log(`PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}`);

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
        _utilsLogger.logger.log('parsed   codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
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
              //logger.log(`expectedPTS/PTSnorm:${expectedPTS}/${ptsnorm}/${expectedPTS-ptsnorm}`);
              // check if there is any unexpected drift between expected timestamp and real one
              if (Math.abs(expectedPTS - ptsnorm) > this.PES_TIMESCALE * 3600) {
                //logger.log(`PTS looping ??? AAC PTS delta:${expectedPTS-ptsnorm}`);
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
        //console.log(`PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${aacSample.pts}/${aacSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(aacSample.pts/4294967296).toFixed(3)}`);
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

//import FPSController              from './controller/fps-controller';

var _utilsLogger = require('./utils/logger');

var _utilsXhrLoader = require('./utils/xhr-loader');

var _utilsXhrLoader2 = _interopRequireDefault(_utilsXhrLoader);

var Hls = (function () {
  _createClass(Hls, null, [{
    key: 'isSupported',
    value: function isSupported() {
      return window.MediaSource && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
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
* fragment loader
*
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
      frag.loader = this.loader = new config.loader();
      this.loader.load(frag.url, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, config.fragLoadingMaxRetry, config.fragLoadingRetryDelay, this.loadprogress.bind(this));
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var payload = event.currentTarget.response;
      stats.length = payload.byteLength;
      // detach fragment loader on load success
      this.frag.loader = undefined;
      _observer2['default'].trigger(_events2['default'].FRAG_LOADED, { payload: payload,
        frag: this.frag,
        stats: stats });
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
/*
 * playlist loader
 *
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

//import {logger}             from '../utils/logger';

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
      this.loader = new config.loader();
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
            _observer2['default'].trigger(_events2['default'].MANIFEST_LOADED, { levels: [{ url: url }],
              url: url,
              stats: stats });
          } else {
            _observer2['default'].trigger(_events2['default'].LEVEL_LOADED, { details: this.parseLevelPlaylist(string, url, id),
              level: id,
              id: id2,
              stats: stats });
          }
        } else {
          levels = this.parseMasterPlaylist(string, url);
          // multi level playlist, parse level info
          if (levels.length) {
            _observer2['default'].trigger(_events2['default'].MANIFEST_LOADED, { levels: levels,
              url: url,
              stats: stats });
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
 * generate MP4 Box
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
/*
* Stats Handler
*
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
/*
 * Xhr based Loader
 *
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _utilsLogger = require('../utils/logger');

var XhrLoader = (function () {
  function XhrLoader() {
    _classCallCheck(this, XhrLoader);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2Vycm9ycy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZXZlbnRzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9obHMuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9mcmFnbWVudC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL29ic2VydmVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9yZW11eC9tcDQtZ2VuZXJhdG9yLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9zdGF0cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvbG9nZ2VyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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SSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7QUFDUixZQUFJLEVBQUUsRUFBRTtBQUNSLFlBQUksRUFBRSxFQUFFO0FBQ1IsWUFBSSxFQUFFLEVBQUU7T0FDVCxDQUFDOztBQUVGLFVBQUksQ0FBQyxDQUFDO0FBQ04sV0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtBQUNuQixZQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQy9CLGFBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FDYixDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNmLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQ2YsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFDZixDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUNoQixDQUFDO1NBQ0g7T0FDRjs7QUFFRCxTQUFHLENBQUMsV0FBVyxHQUFHLElBQUksVUFBVSxDQUFDLENBQy9CLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQ2pCLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQ2pCLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQ2pCLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQ2xCLENBQUMsQ0FBQztBQUNILFNBQUcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FDOUIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFDakIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFDakIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFDakIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FDbEIsQ0FBQyxDQUFDO0FBQ0gsU0FBRyxDQUFDLGFBQWEsR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakQsU0FBRyxDQUFDLFVBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUM5QixJQUFJO0FBQ0osVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7T0FDN0IsQ0FBQyxDQUFDO0FBQ0gsU0FBRyxDQUFDLFVBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUM5QixJQUFJO0FBQ0osVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7T0FDN0IsQ0FBQyxDQUFDO0FBQ0gsU0FBRyxDQUFDLFVBQVUsR0FBRztBQUNmLGVBQU8sRUFBQyxHQUFHLENBQUMsVUFBVTtBQUN0QixlQUFPLEVBQUMsR0FBRyxDQUFDLFVBQVU7T0FDdkIsQ0FBQztBQUNGLFNBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FDeEIsSUFBSTtBQUNKLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUNoQixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJO0FBQ0osVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO09BQ2pCLENBQUMsQ0FBQztBQUNILFNBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FDeEIsSUFBSTtBQUNKLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUNoQixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO09BQ3ZCLENBQUMsQ0FBQztBQUNILFNBQUcsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztBQUNwQixTQUFHLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFDcEIsU0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUN4QixJQUFJO0FBQ0osVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUN2QixDQUFDLENBQUM7O0FBQ0gsU0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUN4QixJQUFJO0FBQ0osVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUksRUFDVixJQUFJLEVBQUUsSUFBSSxFQUNWLElBQUksRUFBRSxJQUFJO09BQ1gsQ0FBQyxDQUFDO0FBQ0gsU0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUN4QixJQUFJO0FBQ0osVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUk7T0FDWCxDQUFDLENBQUM7O0FBRUgsU0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUN4QixJQUFJO0FBQ0osVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7O0FBRTNCLFNBQUcsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxhQUFhLEVBQUUsR0FBRyxDQUFDLFdBQVcsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDeEcsU0FBRyxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDdkU7OztXQUVTLGFBQUMsSUFBSSxFQUFFO0FBQ2pCLFVBQ0UsT0FBTyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1VBQ2xELElBQUksR0FBRyxDQUFDO1VBQ1IsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNO1VBQ2xCLE1BQU07VUFDTixJQUFJLENBQUM7OztBQUdMLGFBQU8sQ0FBQyxFQUFFLEVBQUU7QUFDVixZQUFJLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQztPQUMvQjtBQUNELFlBQU0sR0FBRyxJQUFJLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbEMsVUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuQyxVQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDckMsWUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7OztBQUdwQixXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM3QyxjQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM3QixZQUFJLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQztPQUMvQjtBQUNELGFBQU8sTUFBTSxDQUFDO0tBQ2Y7OztXQUVVLGNBQUMsSUFBSSxFQUFFO0FBQ2hCLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDdEQ7OztXQUVVLGNBQUMsSUFBSSxFQUFFO0FBQ2hCLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztLQUN0Qzs7O1dBRVUsY0FBQyxTQUFTLEVBQUMsUUFBUSxFQUFFO0FBQzlCLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxDQUM1QyxJQUFJO0FBQ0osVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixBQUFDLGVBQVMsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN4QixBQUFDLFNBQVMsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN4QixBQUFDLFNBQVMsSUFBSyxDQUFDLEdBQUksSUFBSSxFQUN4QixTQUFTLEdBQUcsSUFBSTtBQUNmLGNBQVEsSUFBSSxFQUFFLEVBQ2YsQUFBQyxRQUFRLElBQUksRUFBRSxHQUFJLElBQUksRUFDdkIsQUFBQyxRQUFRLElBQUssQ0FBQyxHQUFJLElBQUksRUFDdkIsUUFBUSxHQUFHLElBQUk7QUFDZixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJLENBQ1gsQ0FBQyxDQUFDLENBQUM7S0FDTDs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ2pIOzs7V0FFVSxjQUFDLGNBQWMsRUFBRTtBQUMxQixhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxVQUFVLENBQUMsQ0FDNUMsSUFBSSxFQUNKLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUNmLG9CQUFjLElBQUksRUFBRSxFQUNyQixBQUFDLGNBQWMsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUM3QixBQUFDLGNBQWMsSUFBSyxDQUFDLEdBQUksSUFBSSxFQUM3QixjQUFjLEdBQUcsSUFBSSxDQUN0QixDQUFDLENBQUMsQ0FBQztLQUNMOzs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsVUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTtBQUMxQixlQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7T0FDOUYsTUFBTTtBQUNMLGVBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztPQUM5RjtLQUNGOzs7V0FFVSxjQUFDLEVBQUUsRUFBRSxtQkFBbUIsRUFBRSxLQUFLLEVBQUU7QUFDMUMsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUNkLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQ1osR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0tBQ3JEOzs7Ozs7O1dBSVUsY0FBQyxNQUFNLEVBQUU7QUFDbEIsVUFDRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU07VUFDakIsS0FBSyxHQUFHLEVBQUUsQ0FBQzs7QUFFYixhQUFPLENBQUMsRUFBRSxFQUFFO0FBQ1YsYUFBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDaEM7O0FBRUQsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN2STs7O1dBRVUsY0FBQyxNQUFNLEVBQUU7QUFDbEIsVUFDRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU07VUFDakIsS0FBSyxHQUFHLEVBQUUsQ0FBQzs7QUFFYixhQUFPLENBQUMsRUFBRSxFQUFFO0FBQ1YsYUFBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDaEM7QUFDRCxhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDNUQ7OztXQUVVLGNBQUMsU0FBUyxFQUFDLFFBQVEsRUFBRTtBQUM5QixVQUNFLEtBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUNyQixJQUFJO0FBQ0osVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixBQUFDLGVBQVMsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN4QixBQUFDLFNBQVMsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN4QixBQUFDLFNBQVMsSUFBSyxDQUFDLEdBQUksSUFBSSxFQUN4QixTQUFTLEdBQUcsSUFBSTtBQUNoQixBQUFDLGNBQVEsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN2QixBQUFDLFFBQVEsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN2QixBQUFDLFFBQVEsSUFBSyxDQUFDLEdBQUksSUFBSSxFQUN2QixRQUFRLEdBQUcsSUFBSTtBQUNmLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO09BQ3ZCLENBQUMsQ0FBQztBQUNMLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztLQUN2Qzs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsVUFDRSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxFQUFFO1VBQzdCLEtBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztVQUMxQyxLQUFLO1VBQ0wsQ0FBQyxDQUFDOzs7OztBQUtKLFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNuQyxhQUFLLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUN6QixhQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEFBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLEdBQ2pDLEtBQUssQ0FBQyxZQUFZLElBQUksQ0FBQyxBQUFDLEdBQ3hCLEtBQUssQ0FBQyxhQUFhLEFBQUMsQ0FBQztPQUN6Qjs7QUFFRCxhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQ2xCLEtBQUssQ0FBQyxDQUFDO0tBQ25COzs7V0FFVSxjQUFDLEtBQUssRUFBRTtBQUNqQixhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQ2xCLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQ2YsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQ2pDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUNqQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFDakMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUMvQzs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsVUFBSSxHQUFHLEdBQUcsRUFBRTtVQUFFLEdBQUcsR0FBRyxFQUFFO1VBQUUsQ0FBQyxDQUFDOztBQUUxQixXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLFdBQUcsQ0FBQyxJQUFJLENBQUMsQUFBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsS0FBSyxDQUFDLEdBQUksSUFBSSxDQUFDLENBQUM7QUFDakQsV0FBRyxDQUFDLElBQUksQ0FBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUUsQ0FBQztBQUMzQyxXQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDNUQ7OztBQUdELFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDckMsV0FBRyxDQUFDLElBQUksQ0FBQyxBQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxLQUFLLENBQUMsR0FBSSxJQUFJLENBQUMsQ0FBQztBQUNqRCxXQUFHLENBQUMsSUFBSSxDQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBRSxDQUFDO0FBQzNDLFdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztPQUM1RDs7QUFFRCxhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxVQUFVLENBQUMsQ0FDMUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUNoQixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixBQUFDLFdBQUssQ0FBQyxLQUFLLElBQUksQ0FBQyxHQUFJLElBQUksRUFDekIsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJO0FBQ2xCLEFBQUMsV0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLEdBQUksSUFBSSxFQUMxQixLQUFLLENBQUMsTUFBTSxHQUFHLElBQUk7QUFDbkIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQ0osSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDaEIsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDVixTQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksVUFBVSxDQUFDLENBQ3JDLElBQUk7QUFDSixXQUFLLENBQUMsVUFBVTtBQUNoQixX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QUFDO0FBQ2xELFVBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNsQzs7O1dBRVcsc0JBQUMsS0FBSyxFQUFFO0FBQ2xCLFVBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDdkIsVUFBRyxLQUFLLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtBQUN4QixhQUFLLENBQUMsTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7T0FDM0I7QUFDRCxXQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDNUIsVUFBRyxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ2xCLFlBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO09BQy9CO0tBQ0Y7OztTQWxGSSxTQUFTOzs7cUJBcUZELFNBQVMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIGJ1bmRsZUZuID0gYXJndW1lbnRzWzNdO1xudmFyIHNvdXJjZXMgPSBhcmd1bWVudHNbNF07XG52YXIgY2FjaGUgPSBhcmd1bWVudHNbNV07XG5cbnZhciBzdHJpbmdpZnkgPSBKU09OLnN0cmluZ2lmeTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciB3a2V5O1xuICAgIHZhciBjYWNoZUtleXMgPSBPYmplY3Qua2V5cyhjYWNoZSk7XG4gICAgXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgIGlmIChjYWNoZVtrZXldLmV4cG9ydHMgPT09IGZuKSB7XG4gICAgICAgICAgICB3a2V5ID0ga2V5O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKCF3a2V5KSB7XG4gICAgICAgIHdrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgdmFyIHdjYWNoZSA9IHt9O1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgICAgICB3Y2FjaGVba2V5XSA9IGtleTtcbiAgICAgICAgfVxuICAgICAgICBzb3VyY2VzW3drZXldID0gW1xuICAgICAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJywnbW9kdWxlJywnZXhwb3J0cyddLCAnKCcgKyBmbiArICcpKHNlbGYpJyksXG4gICAgICAgICAgICB3Y2FjaGVcbiAgICAgICAgXTtcbiAgICB9XG4gICAgdmFyIHNrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICBcbiAgICB2YXIgc2NhY2hlID0ge307IHNjYWNoZVt3a2V5XSA9IHdrZXk7XG4gICAgc291cmNlc1tza2V5XSA9IFtcbiAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJ10sJ3JlcXVpcmUoJyArIHN0cmluZ2lmeSh3a2V5KSArICcpKHNlbGYpJyksXG4gICAgICAgIHNjYWNoZVxuICAgIF07XG4gICAgXG4gICAgdmFyIHNyYyA9ICcoJyArIGJ1bmRsZUZuICsgJykoeydcbiAgICAgICAgKyBPYmplY3Qua2V5cyhzb3VyY2VzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ2lmeShrZXkpICsgJzpbJ1xuICAgICAgICAgICAgICAgICsgc291cmNlc1trZXldWzBdXG4gICAgICAgICAgICAgICAgKyAnLCcgKyBzdHJpbmdpZnkoc291cmNlc1trZXldWzFdKSArICddJ1xuICAgICAgICAgICAgO1xuICAgICAgICB9KS5qb2luKCcsJylcbiAgICAgICAgKyAnfSx7fSxbJyArIHN0cmluZ2lmeShza2V5KSArICddKSdcbiAgICA7XG4gICAgXG4gICAgdmFyIFVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTCB8fCB3aW5kb3cubW96VVJMIHx8IHdpbmRvdy5tc1VSTDtcbiAgICBcbiAgICByZXR1cm4gbmV3IFdvcmtlcihVUkwuY3JlYXRlT2JqZWN0VVJMKFxuICAgICAgICBuZXcgQmxvYihbc3JjXSwgeyB0eXBlOiAndGV4dC9qYXZhc2NyaXB0JyB9KVxuICAgICkpO1xufTtcbiIsIi8qXG4gKiBidWZmZXIgY29udHJvbGxlclxuICpcbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbiBpbXBvcnQgRGVtdXhlciAgICAgICAgICAgICAgZnJvbSAnLi4vZGVtdXgvZGVtdXhlcic7XG4gaW1wb3J0IHtFcnJvclR5cGVzLEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIEJ1ZmZlckNvbnRyb2xsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuRVJST1IgPSAtMjtcbiAgICB0aGlzLlNUQVJUSU5HID0gLTE7XG4gICAgdGhpcy5JRExFID0gMDtcbiAgICB0aGlzLkxPQURJTkcgPSAgMTtcbiAgICB0aGlzLldBSVRJTkdfTEVWRUwgPSAyO1xuICAgIHRoaXMuUEFSU0lORyA9IDM7XG4gICAgdGhpcy5QQVJTRUQgPSA0O1xuICAgIHRoaXMuQVBQRU5ESU5HID0gNTtcbiAgICB0aGlzLkJVRkZFUl9GTFVTSElORyA9IDY7XG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IDA7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgLy8gU291cmNlIEJ1ZmZlciBsaXN0ZW5lcnNcbiAgICB0aGlzLm9uc2J1ZSA9IHRoaXMub25Tb3VyY2VCdWZmZXJVcGRhdGVFbmQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uc2JlICA9IHRoaXMub25Tb3VyY2VCdWZmZXJFcnJvci5iaW5kKHRoaXMpO1xuICAgIC8vIGludGVybmFsIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTVNFQXR0YWNoZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNlZCA9IHRoaXMub25NU0VEZXRhY2hlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tcCA9IHRoaXMub25NYW5pZmVzdFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbCA9IHRoaXMub25GcmFnbWVudExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25pcyA9IHRoaXMub25Jbml0U2VnbWVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcGcgPSB0aGlzLm9uRnJhZ21lbnRQYXJzaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwID0gdGhpcy5vbkZyYWdtZW50UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmVyciA9IHRoaXMub25FcnJvci5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTVNFX0FUVEFDSEVELCB0aGlzLm9ubXNlKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NU0VfREVUQUNIRUQsIHRoaXMub25tc2VkKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHRoaXMub25tcCk7XG4gIH1cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICAgIC8vIHJlbW92ZSB2aWRlbyBsaXN0ZW5lclxuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2luZycsdGhpcy5vbnZzZWVraW5nKTtcbiAgICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2VkJyx0aGlzLm9udnNlZWtlZCk7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJyx0aGlzLm9udm1ldGFkYXRhKTtcbiAgICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub252c2Vla2VkID0gdGhpcy5vbnZtZXRhZGF0YSA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gIH1cblxuICBzdGFydExvYWQoKSB7XG4gICAgaWYodGhpcy5sZXZlbHMgJiYgdGhpcy52aWRlbykge1xuICAgICAgdGhpcy5zdGFydEludGVybmFsKCk7XG4gICAgICBpZih0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICBsb2dnZXIubG9nKGByZXN1bWluZyB2aWRlbyBAICR7dGhpcy5sYXN0Q3VycmVudFRpbWV9YCk7XG4gICAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lO1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5TVEFSVElORztcbiAgICAgIH1cbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybihgY2Fubm90IHN0YXJ0IGxvYWRpbmcgYXMgZWl0aGVyIG1hbmlmZXN0IG5vdCBwYXJzZWQgb3IgdmlkZW8gbm90IGF0dGFjaGVkYCk7XG4gICAgfVxuICB9XG5cbiAgc3RhcnRJbnRlcm5hbCgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcih0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgIHRoaXMubGV2ZWwgPSAtMTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB0aGlzLm9uZnBnKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgdGhpcy5vbmZwKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICB9XG5cblxuICBzdG9wKCkge1xuICAgIHRoaXMubXA0c2VnbWVudHMgPSBbXTtcbiAgICB0aGlzLmZsdXNoUmFuZ2UgPSBbXTtcbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gW107XG4gICAgaWYodGhpcy5mcmFnKSB7XG4gICAgICBpZih0aGlzLmZyYWcubG9hZGVyKSB7XG4gICAgICAgIHRoaXMuZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZih0aGlzLmRlbXV4ZXIpIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgdGhpcy5vbmZwZyk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgdGhpcy5vbmlzKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRVJST1IsIHRoaXMub25lcnIpO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgcG9zLGxldmVsLGxldmVsRGV0YWlscyxmcmFnSWR4O1xuICAgIHN3aXRjaCh0aGlzLnN0YXRlKSB7XG4gICAgICBjYXNlIHRoaXMuRVJST1I6XG4gICAgICAgIC8vZG9uJ3QgZG8gYW55dGhpbmcgaW4gZXJyb3Igc3RhdGUgdG8gYXZvaWQgYnJlYWtpbmcgZnVydGhlciAuLi5cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IHRoaXMuaGxzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgLy8gLTEgOiBndWVzcyBzdGFydCBMZXZlbCBieSBkb2luZyBhIGJpdHJhdGUgdGVzdCBieSBsb2FkaW5nIGZpcnN0IGZyYWdtZW50IG9mIGxvd2VzdCBxdWFsaXR5IGxldmVsXG4gICAgICAgICAgdGhpcy5zdGFydExldmVsID0gMDtcbiAgICAgICAgICB0aGlzLmZyYWdtZW50Qml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsID0gdGhpcy5obHMubmV4dExvYWRMZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuV0FJVElOR19MRVZFTDtcbiAgICAgICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5JRExFOlxuICAgICAgICAvLyBoYW5kbGUgZW5kIG9mIGltbWVkaWF0ZSBzd2l0Y2hpbmcgaWYgbmVlZGVkXG4gICAgICAgIGlmKHRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICAgICAgdGhpcy5pbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdmlkZW8gZGV0YWNoZWQgb3IgdW5ib3VuZCBleGl0IGxvb3BcbiAgICAgICAgaWYoIXRoaXMudmlkZW8pIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNlZWsgYmFjayB0byBhIGV4cGVjdGVkIHBvc2l0aW9uIGFmdGVyIHZpZGVvIHN0YWxsaW5nXG4gICAgICAgIGlmKHRoaXMuc2Vla0FmdGVyU3RhbGxpbmcpIHtcbiAgICAgICAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lPXRoaXMuc2Vla0FmdGVyU3RhbGxpbmc7XG4gICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJTdGFsbGluZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGNhbmRpZGF0ZSBmcmFnbWVudCB0byBiZSBsb2FkZWQsIGJhc2VkIG9uIGN1cnJlbnQgcG9zaXRpb24gYW5kXG4gICAgICAgIC8vICBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgIC8vICBlbnN1cmUgNjBzIG9mIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIHdlIGhhdmUgbm90IHlldCBsb2FkZWQgYW55IGZyYWdtZW50LCBzdGFydCBsb2FkaW5nIGZyb20gc3RhcnQgcG9zaXRpb25cbiAgICAgICAgaWYodGhpcy5sb2FkZWRtZXRhZGF0YSkge1xuICAgICAgICAgIHBvcyA9IHRoaXMudmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5uZXh0TG9hZFBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGxvYWQgbGV2ZWxcbiAgICAgICAgaWYodGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbGV2ZWwgPSB0aGlzLmhscy5uZXh0TG9hZExldmVsO1xuICAgICAgICB9XG4gICAgICAgIHZhciBidWZmZXJJbmZvID0gdGhpcy5idWZmZXJJbmZvKHBvcyksIGJ1ZmZlckxlbiA9IGJ1ZmZlckluZm8ubGVuLCBidWZmZXJFbmQgPSBidWZmZXJJbmZvLmVuZCwgbWF4QnVmTGVuO1xuICAgICAgICAvLyBjb21wdXRlIG1heCBCdWZmZXIgTGVuZ3RoIHRoYXQgd2UgY291bGQgZ2V0IGZyb20gdGhpcyBsb2FkIGxldmVsLCBiYXNlZCBvbiBsZXZlbCBiaXRyYXRlLiBkb24ndCBidWZmZXIgbW9yZSB0aGFuIDYwIE1CIGFuZCBtb3JlIHRoYW4gMzBzXG4gICAgICAgIGlmKCh0aGlzLmxldmVsc1tsZXZlbF0pLmhhc093blByb3BlcnR5KCdiaXRyYXRlJykpIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1heCg4KnRoaXMuY29uZmlnLm1heEJ1ZmZlclNpemUvdGhpcy5sZXZlbHNbbGV2ZWxdLmJpdHJhdGUsdGhpcy5jb25maWcubWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1pbihtYXhCdWZMZW4sdGhpcy5jb25maWcubWF4TWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSB0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gbWF4QnVmTGVuIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICAgIGlmKGJ1ZmZlckxlbiA8IG1heEJ1Zkxlbikge1xuICAgICAgICAgIC8vIHNldCBuZXh0IGxvYWQgbGV2ZWwgOiB0aGlzIHdpbGwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWQgaWYgbmVlZGVkXG4gICAgICAgICAgdGhpcy5obHMubmV4dExvYWRMZXZlbCA9IGxldmVsO1xuICAgICAgICAgIHRoaXMubGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICBsZXZlbERldGFpbHMgPSB0aGlzLmxldmVsc1tsZXZlbF0uZGV0YWlscztcbiAgICAgICAgICAvLyBpZiBsZXZlbCBpbmZvIG5vdCByZXRyaWV2ZWQgeWV0LCBzd2l0Y2ggc3RhdGUgYW5kIHdhaXQgZm9yIGxldmVsIHJldHJpZXZhbFxuICAgICAgICAgIGlmKHR5cGVvZiBsZXZlbERldGFpbHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5XQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgbGV0IGZyYWdtZW50cyA9IGxldmVsRGV0YWlscy5mcmFnbWVudHMsIGZyYWcsIHNsaWRpbmcgPSBsZXZlbERldGFpbHMuc2xpZGluZywgc3RhcnQgPSBmcmFnbWVudHNbMF0uc3RhcnQgKyBzbGlkaW5nLCBkcmlmdCA9MDtcbiAgICAgICAgICAvLyBjaGVjayBpZiByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgd2l0aGluIHNlZWthYmxlIGJvdW5kYXJpZXMgOlxuICAgICAgICAgIC8vIGluIGNhc2Ugb2YgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0IHJlcXVlc3RlZCBwb3NpdGlvbiBpcyBub3QgbG9jYXRlZCBiZWZvcmUgcGxheWxpc3Qgc3RhcnRcbiAgICAgICAgICAvL2xvZ2dlci5sb2coYHN0YXJ0L3Bvcy9idWZFbmQvc2Vla2luZzoke3N0YXJ0LnRvRml4ZWQoMyl9LyR7cG9zLnRvRml4ZWQoMyl9LyR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9LyR7dGhpcy52aWRlby5zZWVraW5nfWApO1xuICAgICAgICAgIGlmKGJ1ZmZlckVuZCA8IHN0YXJ0KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2Vla0FmdGVyU3RhbGxpbmcgPSB0aGlzLnN0YXJ0UG9zaXRpb24gKyBzbGlkaW5nO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBidWZmZXIgZW5kOiAke2J1ZmZlckVuZH0gaXMgbG9jYXRlZCBiZWZvcmUgc3RhcnQgb2YgbGl2ZSBzbGlkaW5nIHBsYXlsaXN0LCBtZWRpYSBwb3NpdGlvbiB3aWxsIGJlIHJlc2V0ZWQgdG86ICR7dGhpcy5zZWVrQWZ0ZXJTdGFsbGluZy50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICBidWZmZXJFbmQgPSB0aGlzLnNlZWtBZnRlclN0YWxsaW5nO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmKGxldmVsRGV0YWlscy5saXZlICYmIGxldmVsRGV0YWlscy5zbGlkaW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8qIHdlIGFyZSBzd2l0Y2hpbmcgbGV2ZWwgb24gbGl2ZSBwbGF5bGlzdCwgYnV0IHdlIGRvbid0IGhhdmUgYW55IHNsaWRpbmcgaW5mbyAuLi5cbiAgICAgICAgICAgICAgIHRyeSB0byBsb2FkIGZyYWcgbWF0Y2hpbmcgd2l0aCBuZXh0IFNOLlxuICAgICAgICAgICAgICAgZXZlbiBpZiBTTiBhcmUgbm90IHN5bmNocm9uaXplZCBiZXR3ZWVuIHBsYXlsaXN0cywgbG9hZGluZyB0aGlzIGZyYWcgd2lsbCBoZWxwIHVzXG4gICAgICAgICAgICAgICBjb21wdXRlIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZSBhZnRlciBpbiBjYXNlIGl0IHdhcyBub3QgdGhlIHJpZ2h0IGNvbnNlY3V0aXZlIG9uZSAqL1xuICAgICAgICAgICAgaWYodGhpcy5mcmFnKSB7XG4gICAgICAgICAgICAgIHZhciB0YXJnZXRTTiA9IHRoaXMuZnJhZy5zbisxO1xuICAgICAgICAgICAgICBpZih0YXJnZXRTTiA+PSBsZXZlbERldGFpbHMuc3RhcnRTTiAmJiB0YXJnZXRTTiA8PSBsZXZlbERldGFpbHMuZW5kU04pIHtcbiAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW3RhcmdldFNOLWxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIGxvYWQgZnJhZyB3aXRoIG5leHQgU046ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoIWZyYWcpIHtcbiAgICAgICAgICAgICAgLyogd2UgaGF2ZSBubyBpZGVhIGFib3V0IHdoaWNoIGZyYWdtZW50IHNob3VsZCBiZSBsb2FkZWQuXG4gICAgICAgICAgICAgICAgIHNvIGxldCdzIGxvYWQgbWlkIGZyYWdtZW50LiBpdCB3aWxsIGhlbHAgY29tcHV0aW5nIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZVxuICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW01hdGgucm91bmQoZnJhZ21lbnRzLmxlbmd0aC8yKV07XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgdW5rbm93biwgbG9hZCBtaWRkbGUgZnJhZyA6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vbG9vayBmb3IgZnJhZ21lbnRzIG1hdGNoaW5nIHdpdGggY3VycmVudCBwbGF5IHBvc2l0aW9uXG4gICAgICAgICAgICBmb3IgKGZyYWdJZHggPSAwOyBmcmFnSWR4IDwgZnJhZ21lbnRzLmxlbmd0aCA7IGZyYWdJZHgrKykge1xuICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHhdO1xuICAgICAgICAgICAgICBzdGFydCA9IGZyYWcuc3RhcnQrc2xpZGluZztcbiAgICAgICAgICAgICAgaWYoZnJhZy5kcmlmdCkge1xuICAgICAgICAgICAgICAgIGRyaWZ0ID0gZnJhZy5kcmlmdDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBzdGFydCs9ZHJpZnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgbGV2ZWwvc24vc2xpZGluZy9kcmlmdC9zdGFydC9lbmQvYnVmRW5kOiR7bGV2ZWx9LyR7ZnJhZy5zbn0vJHtzbGlkaW5nLnRvRml4ZWQoMyl9LyR7ZHJpZnQudG9GaXhlZCgzKX0vJHtzdGFydC50b0ZpeGVkKDMpfS8keyhzdGFydCtmcmFnLmR1cmF0aW9uKS50b0ZpeGVkKDMpfS8ke2J1ZmZlckVuZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICAvLyBvZmZzZXQgc2hvdWxkIGJlIHdpdGhpbiBmcmFnbWVudCBib3VuZGFyeVxuICAgICAgICAgICAgICBpZihzdGFydCA8PSBidWZmZXJFbmQgJiYgKHN0YXJ0ICsgZnJhZy5kdXJhdGlvbikgPiBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoZnJhZ0lkeCA9PT0gZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAvLyByZWFjaCBlbmQgb2YgcGxheWxpc3RcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgU04gbWF0Y2hpbmcgd2l0aCBwb3M6JyArICBidWZmZXJFbmQgKyAnOicgKyBmcmFnLnNuKTtcbiAgICAgICAgICAgIGlmKHRoaXMuZnJhZyAmJiBmcmFnLnNuID09PSB0aGlzLmZyYWcuc24pIHtcbiAgICAgICAgICAgICAgaWYoZnJhZ0lkeCA9PT0gKGZyYWdtZW50cy5sZW5ndGggLTEpKSB7XG4gICAgICAgICAgICAgICAgLy8gd2UgYXJlIGF0IHRoZSBlbmQgb2YgdGhlIHBsYXlsaXN0IGFuZCB3ZSBhbHJlYWR5IGxvYWRlZCBsYXN0IGZyYWdtZW50LCBkb24ndCBkbyBhbnl0aGluZ1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeCsxXTtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBTTiBqdXN0IGxvYWRlZCwgbG9hZCBuZXh0IG9uZTogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGxvZ2dlci5sb2coYExvYWRpbmcgICAgICAgJHtmcmFnLnNufSBvZiBbJHtsZXZlbERldGFpbHMuc3RhcnRTTn0gLCR7bGV2ZWxEZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH0sIGN1cnJlbnRUaW1lOiR7cG9zfSxidWZmZXJFbmQ6JHtidWZmZXJFbmQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJyAgICAgIGxvYWRpbmcgZnJhZyAnICsgaSArJyxwb3MvYnVmRW5kOicgKyBwb3MudG9GaXhlZCgzKSArICcvJyArIGJ1ZmZlckVuZC50b0ZpeGVkKDMpKTtcbiAgICAgICAgICBmcmFnLmRyaWZ0ID0gZHJpZnQ7XG4gICAgICAgICAgZnJhZy5hdXRvTGV2ZWwgPSB0aGlzLmhscy5hdXRvTGV2ZWxFbmFibGVkO1xuICAgICAgICAgIGlmKHRoaXMubGV2ZWxzLmxlbmd0aD4xKSB7XG4gICAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gTWF0aC5yb3VuZChmcmFnLmR1cmF0aW9uKnRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlLzgpO1xuICAgICAgICAgICAgZnJhZy50cmVxdWVzdCA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gZW5zdXJlIHRoYXQgd2UgYXJlIG5vdCByZWxvYWRpbmcgdGhlIHNhbWUgZnJhZ21lbnRzIGluIGxvb3AgLi4uXG4gICAgICAgICAgaWYodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4Kys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHggPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZihmcmFnLmxvYWRDb3VudGVyKSB7XG4gICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyKys7XG4gICAgICAgICAgICBsZXQgbWF4VGhyZXNob2xkID0gdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgICAgICAgLy8gaWYgdGhpcyBmcmFnIGhhcyBhbHJlYWR5IGJlZW4gbG9hZGVkIDMgdGltZXMsIGFuZCBpZiBpdCBoYXMgYmVlbiByZWxvYWRlZCByZWNlbnRseVxuICAgICAgICAgICAgaWYoZnJhZy5sb2FkQ291bnRlciA+IG1heFRocmVzaG9sZCAmJiAoTWF0aC5hYnModGhpcy5mcmFnTG9hZElkeCAtIGZyYWcubG9hZElkeCkgPCBtYXhUaHJlc2hvbGQpKSB7XG4gICAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUiwgZmF0YWw6ZmFsc2UsIGZyYWcgOiBmcmFnfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlcj0xO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmcmFnLmxvYWRJZHggPSB0aGlzLmZyYWdMb2FkSWR4O1xuICAgICAgICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgICAgICAgdGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRElORywgeyBmcmFnOiBmcmFnIH0pO1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLkxPQURJTkc7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuV0FJVElOR19MRVZFTDpcbiAgICAgICAgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAgICAgLy8gY2hlY2sgaWYgcGxheWxpc3QgaXMgYWxyZWFkeSBsb2FkZWRcbiAgICAgICAgaWYobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuTE9BRElORzpcbiAgICAgICAgLypcbiAgICAgICAgICBtb25pdG9yIGZyYWdtZW50IHJldHJpZXZhbCB0aW1lLi4uXG4gICAgICAgICAgd2UgY29tcHV0ZSBleHBlY3RlZCB0aW1lIG9mIGFycml2YWwgb2YgdGhlIGNvbXBsZXRlIGZyYWdtZW50LlxuICAgICAgICAgIHdlIGNvbXBhcmUgaXQgdG8gZXhwZWN0ZWQgdGltZSBvZiBidWZmZXIgc3RhcnZhdGlvblxuICAgICAgICAqL1xuICAgICAgICBsZXQgdiA9IHRoaXMudmlkZW8sZnJhZyA9IHRoaXMuZnJhZztcbiAgICAgICAgLyogb25seSBtb25pdG9yIGZyYWcgcmV0cmlldmFsIHRpbWUgaWZcbiAgICAgICAgKHZpZGVvIG5vdCBwYXVzZWQgT1IgZmlyc3QgZnJhZ21lbnQgYmVpbmcgbG9hZGVkKSBBTkQgYXV0b3N3aXRjaGluZyBlbmFibGVkIEFORCBub3QgbG93ZXN0IGxldmVsIEFORCBtdWx0aXBsZSBsZXZlbHMgKi9cbiAgICAgICAgaWYodiAmJiAoIXYucGF1c2VkIHx8IHRoaXMubG9hZGVkbWV0YWRhdGEgPT09IGZhbHNlKSAmJiBmcmFnLmF1dG9MZXZlbCAmJiB0aGlzLmxldmVsICYmIHRoaXMubGV2ZWxzLmxlbmd0aD4xICkge1xuICAgICAgICAgIHZhciByZXF1ZXN0RGVsYXk9bmV3IERhdGUoKS1mcmFnLnRyZXF1ZXN0O1xuICAgICAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICAgICAgaWYocmVxdWVzdERlbGF5ID4gNTAwKmZyYWcuZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHZhciBsb2FkUmF0ZSA9IGZyYWcubG9hZGVkKjEwMDAvcmVxdWVzdERlbGF5OyAvLyBieXRlL3NcbiAgICAgICAgICAgIGlmKGZyYWcuZXhwZWN0ZWRMZW4gPCBmcmFnLmxvYWRlZCkge1xuICAgICAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gZnJhZy5sb2FkZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwb3MgPSB2LmN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgdmFyIGZyYWdMb2FkZWREZWxheSA9KGZyYWcuZXhwZWN0ZWRMZW4tZnJhZy5sb2FkZWQpL2xvYWRSYXRlO1xuICAgICAgICAgICAgdmFyIGJ1ZmZlclN0YXJ2YXRpb25EZWxheT10aGlzLmJ1ZmZlckluZm8ocG9zKS5lbmQtcG9zO1xuICAgICAgICAgICAgdmFyIGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA9IGZyYWcuZHVyYXRpb24qdGhpcy5sZXZlbHNbdGhpcy5obHMubmV4dExvYWRMZXZlbF0uYml0cmF0ZS8oOCpsb2FkUmF0ZSk7IC8vYnBzL0Jwc1xuICAgICAgICAgICAgLyogaWYgd2UgaGF2ZSBsZXNzIHRoYW4gMiBmcmFnIGR1cmF0aW9uIGluIGJ1ZmZlciBhbmQgaWYgZnJhZyBsb2FkZWQgZGVsYXkgaXMgZ3JlYXRlciB0aGFuIGJ1ZmZlciBzdGFydmF0aW9uIGRlbGF5XG4gICAgICAgICAgICAgIC4uLiBhbmQgYWxzbyBiaWdnZXIgdGhhbiBkdXJhdGlvbiBuZWVkZWQgdG8gbG9hZCBmcmFnbWVudCBhdCBuZXh0IGxldmVsIC4uLiovXG4gICAgICAgICAgICBpZihidWZmZXJTdGFydmF0aW9uRGVsYXkgPCAyKmZyYWcuZHVyYXRpb24gJiYgZnJhZ0xvYWRlZERlbGF5ID4gYnVmZmVyU3RhcnZhdGlvbkRlbGF5ICYmIGZyYWdMb2FkZWREZWxheSA+IGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIC4uLlxuICAgICAgICAgICAgICBsb2dnZXIud2FybignbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZycpO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmcmFnTG9hZGVkRGVsYXkvYnVmZmVyU3RhcnZhdGlvbkRlbGF5L2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA6JHtmcmFnTG9hZGVkRGVsYXkudG9GaXhlZCgxKX0vJHtidWZmZXJTdGFydmF0aW9uRGVsYXkudG9GaXhlZCgxKX0vJHtmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkudG9GaXhlZCgxKX1gKTtcbiAgICAgICAgICAgICAgLy9hYm9ydCBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB7IGZyYWc6IGZyYWcgfSk7XG4gICAgICAgICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgdG8gcmVxdWVzdCBuZXcgZnJhZ21lbnQgYXQgbG93ZXN0IGxldmVsXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSB0aGlzLlBBUlNJTkc6XG4gICAgICAgIC8vIG5vdGhpbmcgdG8gZG8sIHdhaXQgZm9yIGZyYWdtZW50IGJlaW5nIHBhcnNlZFxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5QQVJTRUQ6XG4gICAgICBjYXNlIHRoaXMuQVBQRU5ESU5HOlxuICAgICAgICBpZiAodGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgICAvLyBpZiBNUDQgc2VnbWVudCBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3Mgbm90aGluZyB0byBkb1xuICAgICAgICAgIGlmKCh0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpby51cGRhdGluZykgfHxcbiAgICAgICAgICAgICAodGhpcy5zb3VyY2VCdWZmZXIudmlkZW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIudmlkZW8udXBkYXRpbmcpKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3NiIGFwcGVuZCBpbiBwcm9ncmVzcycpO1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgTVA0IHNlZ21lbnRzIGxlZnQgdG8gYXBwZW5kXG4gICAgICAgICAgfSBlbHNlIGlmKHRoaXMubXA0c2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VnbWVudCA9IHRoaXMubXA0c2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9YCk7XG4gICAgICAgICAgICAgIHRoaXMuc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0uYXBwZW5kQnVmZmVyKHNlZ21lbnQuZGF0YSk7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3I9MDtcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgIC8vIGluIGNhc2UgYW55IGVycm9yIG9jY3VyZWQgd2hpbGUgYXBwZW5kaW5nLCBwdXQgYmFjayBzZWdtZW50IGluIG1wNHNlZ21lbnRzIHRhYmxlXG4gICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgZXJyb3Igd2hpbGUgdHJ5aW5nIHRvIGFwcGVuZCBidWZmZXI6JHtlcnIubWVzc2FnZX0sdHJ5IGFwcGVuZGluZyBsYXRlcmApO1xuICAgICAgICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnVuc2hpZnQoc2VnbWVudCk7XG4gICAgICAgICAgICAgIGlmKHRoaXMuYXBwZW5kRXJyb3IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvcj0xO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhciBldmVudCA9IHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0FQUEVORElOR19FUlJPUiwgZnJhZyA6IHRoaXMuZnJhZ307XG4gICAgICAgICAgICAgIC8qIHdpdGggVUhEIGNvbnRlbnQsIHdlIGNvdWxkIGdldCBsb29wIG9mIHF1b3RhIGV4Y2VlZGVkIGVycm9yIHVudGlsXG4gICAgICAgICAgICAgICAgYnJvd3NlciBpcyBhYmxlIHRvIGV2aWN0IHNvbWUgZGF0YSBmcm9tIHNvdXJjZWJ1ZmZlci4gcmV0cnlpbmcgaGVscCByZWNvdmVyaW5nIHRoaXNcbiAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgaWYodGhpcy5hcHBlbmRFcnJvciA+IHRoaXMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnkpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmYWlsICR7dGhpcy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeX0gdGltZXMgdG8gYXBwZW5kIHNlZ21lbnQgaW4gc291cmNlQnVmZmVyYCk7XG4gICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5FUlJPUjtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLkFQUEVORElORztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gc291cmNlQnVmZmVyIHVuZGVmaW5lZCwgc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZVxuICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuQlVGRkVSX0ZMVVNISU5HOlxuICAgICAgICAvLyBsb29wIHRocm91Z2ggYWxsIGJ1ZmZlciByYW5nZXMgdG8gZmx1c2hcbiAgICAgICAgd2hpbGUodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCkge1xuICAgICAgICAgIHZhciByYW5nZSA9IHRoaXMuZmx1c2hSYW5nZVswXTtcbiAgICAgICAgICAvLyBmbHVzaEJ1ZmZlciB3aWxsIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzIGFuZCBmbHVzaCBBdWRpby9WaWRlbyBCdWZmZXJcbiAgICAgICAgICBpZih0aGlzLmZsdXNoQnVmZmVyKHJhbmdlLnN0YXJ0LHJhbmdlLmVuZCkpIHtcbiAgICAgICAgICAgIC8vIHJhbmdlIGZsdXNoZWQsIHJlbW92ZSBmcm9tIGZsdXNoIGFycmF5XG4gICAgICAgICAgICB0aGlzLmZsdXNoUmFuZ2Uuc2hpZnQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmx1c2ggaW4gcHJvZ3Jlc3MsIGNvbWUgYmFjayBsYXRlclxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIC8vIG1vdmUgdG8gSURMRSBvbmNlIGZsdXNoIGNvbXBsZXRlLiB0aGlzIHNob3VsZCB0cmlnZ2VyIG5ldyBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgICAgICAgICAvLyByZXNldCByZWZlcmVuY2UgdG8gZnJhZ1xuICAgICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgIC8qIGlmIG5vdCBldmVyeXRoaW5nIGZsdXNoZWQsIHN0YXkgaW4gQlVGRkVSX0ZMVVNISU5HIHN0YXRlLiB3ZSB3aWxsIGNvbWUgYmFjayBoZXJlXG4gICAgICAgICAgICBlYWNoIHRpbWUgc291cmNlQnVmZmVyIHVwZGF0ZWVuZCgpIGNhbGxiYWNrIHdpbGwgYmUgdHJpZ2dlcmVkXG4gICAgICAgICAgICAqL1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBjaGVjay91cGRhdGUgY3VycmVudCBmcmFnbWVudFxuICAgIHRoaXMuX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCk7XG4gIH1cblxuICAgYnVmZmVySW5mbyhwb3MpIHtcbiAgICB2YXIgdiA9IHRoaXMudmlkZW8sXG4gICAgICAgIGJ1ZmZlcmVkID0gdi5idWZmZXJlZCxcbiAgICAgICAgYnVmZmVyTGVuLFxuICAgICAgICAvLyBidWZmZXJTdGFydCBhbmQgYnVmZmVyRW5kIGFyZSBidWZmZXIgYm91bmRhcmllcyBhcm91bmQgY3VycmVudCB2aWRlbyBwb3NpdGlvblxuICAgICAgICBidWZmZXJTdGFydCxidWZmZXJFbmQsXG4gICAgICAgIGk7XG4gICAgdmFyIGJ1ZmZlcmVkMiA9IFtdO1xuICAgIC8vIHRoZXJlIG1pZ2h0IGJlIHNvbWUgc21hbGwgaG9sZXMgYmV0d2VlbiBidWZmZXIgdGltZSByYW5nZVxuICAgIC8vIGNvbnNpZGVyIHRoYXQgaG9sZXMgc21hbGxlciB0aGFuIDMwMCBtcyBhcmUgaXJyZWxldmFudCBhbmQgYnVpbGQgYW5vdGhlclxuICAgIC8vIGJ1ZmZlciB0aW1lIHJhbmdlIHJlcHJlc2VudGF0aW9ucyB0aGF0IGRpc2NhcmRzIHRob3NlIGhvbGVzXG4gICAgZm9yKGkgPSAwIDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aCA7IGkrKykge1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZigoYnVmZmVyZWQyLmxlbmd0aCkgJiYgKGJ1ZmZlcmVkLnN0YXJ0KGkpIC0gYnVmZmVyZWQyW2J1ZmZlcmVkMi5sZW5ndGgtMV0uZW5kICkgPCAwLjMpIHtcbiAgICAgICAgYnVmZmVyZWQyW2J1ZmZlcmVkMi5sZW5ndGgtMV0uZW5kID0gYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVmZmVyZWQyLnB1c2goe3N0YXJ0IDogYnVmZmVyZWQuc3RhcnQoaSksZW5kIDogYnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvcyA7IGkgPCBidWZmZXJlZDIubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmKChwb3MrMC4zKSA+PSBidWZmZXJlZDJbaV0uc3RhcnQgJiYgcG9zIDwgYnVmZmVyZWQyW2ldLmVuZCkge1xuICAgICAgICAvLyBwbGF5IHBvc2l0aW9uIGlzIGluc2lkZSB0aGlzIGJ1ZmZlciBUaW1lUmFuZ2UsIHJldHJpZXZlIGVuZCBvZiBidWZmZXIgcG9zaXRpb24gYW5kIGJ1ZmZlciBsZW5ndGhcbiAgICAgICAgYnVmZmVyU3RhcnQgPSBidWZmZXJlZDJbaV0uc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQgKyAwLjM7XG4gICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtsZW4gOiBidWZmZXJMZW4sIHN0YXJ0IDogYnVmZmVyU3RhcnQsIGVuZCA6IGJ1ZmZlckVuZH07XG4gIH1cblxuXG4gIGdldEJ1ZmZlclJhbmdlKHBvc2l0aW9uKSB7XG4gICAgdmFyIGkscmFuZ2U7XG4gICAgZm9yIChpID0gdGhpcy5idWZmZXJSYW5nZS5sZW5ndGgtMTsgaSA+PTAgOyBpLS0pIHtcbiAgICAgIHJhbmdlID0gdGhpcy5idWZmZXJSYW5nZVtpXTtcbiAgICAgIGlmKHBvc2l0aW9uID49IHJhbmdlLnN0YXJ0ICYmIHBvc2l0aW9uIDw9IHJhbmdlLmVuZCkge1xuICAgICAgICByZXR1cm4gcmFuZ2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cblxuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSk7XG4gICAgICBpZihyYW5nZSkge1xuICAgICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgZ2V0IG5leHRCdWZmZXJSYW5nZSgpIHtcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICAvLyBmaXJzdCBnZXQgZW5kIHJhbmdlIG9mIGN1cnJlbnQgZnJhZ21lbnRcbiAgICAgIHJldHVybiB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmb2xsb3dpbmdCdWZmZXJSYW5nZShyYW5nZSkge1xuICAgIGlmKHJhbmdlKSB7XG4gICAgICAvLyB0cnkgdG8gZ2V0IHJhbmdlIG9mIG5leHQgZnJhZ21lbnQgKDUwMG1zIGFmdGVyIHRoaXMgcmFuZ2UpXG4gICAgICByZXR1cm4gdGhpcy5nZXRCdWZmZXJSYW5nZShyYW5nZS5lbmQrMC41KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgdmFyIHJhbmdlID0gdGhpcy5uZXh0QnVmZmVyUmFuZ2U7XG4gICAgaWYocmFuZ2UpIHtcbiAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuICB9XG5cbiAgaXNCdWZmZXJlZChwb3NpdGlvbikge1xuICAgIHZhciB2ID0gdGhpcy52aWRlbyxidWZmZXJlZCA9IHYuYnVmZmVyZWQ7XG4gICAgZm9yKHZhciBpID0gMCA7IGkgPCBidWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgIGlmKHBvc2l0aW9uID49IGJ1ZmZlcmVkLnN0YXJ0KGkpICYmIHBvc2l0aW9uIDw9IGJ1ZmZlcmVkLmVuZChpKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCkge1xuICAgIHZhciByYW5nZUN1cnJlbnQsIGN1cnJlbnRUaW1lO1xuICAgIGlmKHRoaXMudmlkZW8gJiYgdGhpcy52aWRlby5zZWVraW5nID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSBjdXJyZW50VGltZSA9IHRoaXMudmlkZW8uY3VycmVudFRpbWU7XG4gICAgICBpZih0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUpKSB7XG4gICAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UoY3VycmVudFRpbWUpO1xuICAgICAgfSBlbHNlIGlmKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSswLjEpKSB7XG4gICAgICAgIC8qIGVuc3VyZSB0aGF0IEZSQUdfQ0hBTkdFRCBldmVudCBpcyB0cmlnZ2VyZWQgYXQgc3RhcnR1cCxcbiAgICAgICAgICB3aGVuIGZpcnN0IHZpZGVvIGZyYW1lIGlzIGRpc3BsYXllZCBhbmQgcGxheWJhY2sgaXMgcGF1c2VkLlxuICAgICAgICAgIGFkZCBhIHRvbGVyYW5jZSBvZiAxMDBtcywgaW4gY2FzZSBjdXJyZW50IHBvc2l0aW9uIGlzIG5vdCBidWZmZXJlZCxcbiAgICAgICAgICBjaGVjayBpZiBjdXJyZW50IHBvcysxMDBtcyBpcyBidWZmZXJlZCBhbmQgdXNlIHRoYXQgYnVmZmVyIHJhbmdlXG4gICAgICAgICAgZm9yIEZSQUdfQ0hBTkdFRCBldmVudCByZXBvcnRpbmcgKi9cbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSswLjEpO1xuICAgICAgfVxuICAgICAgaWYocmFuZ2VDdXJyZW50KSB7XG4gICAgICAgIGlmKHJhbmdlQ3VycmVudC5mcmFnICE9PSB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IHJhbmdlQ3VycmVudC5mcmFnO1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19DSEFOR0VELCB7IGZyYWcgOiB0aGlzLmZyYWdDdXJyZW50IH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIHN0cmVhbSBpcyBWT0QgKG5vdCBsaXZlKSBhbmQgd2UgcmVhY2ggRW5kIG9mIFN0cmVhbVxuICAgICAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAgICAgaWYobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscyAmJiAhbGV2ZWwuZGV0YWlscy5saXZlICYmICh0aGlzLnZpZGVvLmR1cmF0aW9uIC0gY3VycmVudFRpbWUpIDwgMC4yKSB7XG4gICAgICAgICAgaWYodGhpcy5tZWRpYVNvdXJjZSAmJiB0aGlzLm1lZGlhU291cmNlLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZW5kIG9mIFZvRCBzdHJlYW0gcmVhY2hlZCwgc2lnbmFsIGVuZE9mU3RyZWFtKCkgdG8gTWVkaWFTb3VyY2VgKTtcbiAgICAgICAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgICAgICAgICAgdGhpcy52aWRlbyA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLm1lZGlhU291cmNlLmVuZE9mU3RyZWFtKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbi8qXG4gIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzLCBhbmQgZmx1c2ggYWxsIGJ1ZmZlcmVkIGRhdGFcbiAgcmV0dXJuIHRydWUgb25jZSBldmVyeXRoaW5nIGhhcyBiZWVuIGZsdXNoZWQuXG4gIHNvdXJjZUJ1ZmZlci5hYm9ydCgpIGFuZCBzb3VyY2VCdWZmZXIucmVtb3ZlKCkgYXJlIGFzeW5jaHJvbm91cyBvcGVyYXRpb25zXG4gIHRoZSBpZGVhIGlzIHRvIGNhbGwgdGhpcyBmdW5jdGlvbiBmcm9tIHRpY2soKSB0aW1lciBhbmQgY2FsbCBpdCBhZ2FpbiB1bnRpbCBhbGwgcmVzb3VyY2VzIGhhdmUgYmVlbiBjbGVhbmVkXG4gIHRoZSB0aW1lciBpcyByZWFybWVkIHVwb24gc291cmNlQnVmZmVyIHVwZGF0ZWVuZCgpIGV2ZW50LCBzbyB0aGlzIHNob3VsZCBiZSBvcHRpbWFsXG4qL1xuICBmbHVzaEJ1ZmZlcihzdGFydE9mZnNldCwgZW5kT2Zmc2V0KSB7XG4gICAgdmFyIHNiLGksYnVmU3RhcnQsYnVmRW5kLCBmbHVzaFN0YXJ0LCBmbHVzaEVuZDtcbiAgICAvL2xvZ2dlci5sb2coJ2ZsdXNoQnVmZmVyLHBvcy9zdGFydC9lbmQ6ICcgKyB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lICsgJy8nICsgc3RhcnRPZmZzZXQgKyAnLycgKyBlbmRPZmZzZXQpO1xuICAgIC8vIHNhZmVndWFyZCB0byBhdm9pZCBpbmZpbml0ZSBsb29waW5nXG4gICAgaWYodGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIrKyA8IDIqdGhpcy5idWZmZXJSYW5nZS5sZW5ndGggJiYgdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvcih2YXIgdHlwZSBpbiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICBpZighc2IudXBkYXRpbmcpIHtcbiAgICAgICAgICBmb3IoaSA9IDAgOyBpIDwgc2IuYnVmZmVyZWQubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgICAgICBidWZTdGFydCA9IHNiLmJ1ZmZlcmVkLnN0YXJ0KGkpO1xuICAgICAgICAgICAgYnVmRW5kID0gc2IuYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgICAgICAgLy8gd29ya2Fyb3VuZCBmaXJlZm94IG5vdCBhYmxlIHRvIHByb3Blcmx5IGZsdXNoIG11bHRpcGxlIGJ1ZmZlcmVkIHJhbmdlLlxuICAgICAgICAgICAgaWYobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEgJiYgIGVuZE9mZnNldCA9PT0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBzdGFydE9mZnNldDtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBlbmRPZmZzZXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gTWF0aC5tYXgoYnVmU3RhcnQsc3RhcnRPZmZzZXQpO1xuICAgICAgICAgICAgICBmbHVzaEVuZCA9IE1hdGgubWluKGJ1ZkVuZCxlbmRPZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogc29tZXRpbWVzIHNvdXJjZWJ1ZmZlci5yZW1vdmUoKSBkb2VzIG5vdCBmbHVzaFxuICAgICAgICAgICAgICAgdGhlIGV4YWN0IGV4cGVjdGVkIHRpbWUgcmFuZ2UuXG4gICAgICAgICAgICAgICB0byBhdm9pZCByb3VuZGluZyBpc3N1ZXMvaW5maW5pdGUgbG9vcCxcbiAgICAgICAgICAgICAgIG9ubHkgZmx1c2ggYnVmZmVyIHJhbmdlIG9mIGxlbmd0aCBncmVhdGVyIHRoYW4gNTAwbXMuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYoZmx1c2hFbmQgLSBmbHVzaFN0YXJ0ID4gMC41KSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZsdXNoICR7dHlwZX0gWyR7Zmx1c2hTdGFydH0sJHtmbHVzaEVuZH1dLCBvZiBbJHtidWZTdGFydH0sJHtidWZFbmR9XSwgcG9zOiR7dGhpcy52aWRlby5jdXJyZW50VGltZX1gKTtcbiAgICAgICAgICAgICAgc2IucmVtb3ZlKGZsdXNoU3RhcnQsZmx1c2hFbmQpO1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnYWJvcnQgJyArIHR5cGUgKyAnIGFwcGVuZCBpbiBwcm9ncmVzcycpO1xuICAgICAgICAgIC8vIHRoaXMgd2lsbCBhYm9ydCBhbnkgYXBwZW5kaW5nIGluIHByb2dyZXNzXG4gICAgICAgICAgLy9zYi5hYm9ydCgpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8qIGFmdGVyIHN1Y2Nlc3NmdWwgYnVmZmVyIGZsdXNoaW5nLCByZWJ1aWxkIGJ1ZmZlciBSYW5nZSBhcnJheVxuICAgICAgbG9vcCB0aHJvdWdoIGV4aXN0aW5nIGJ1ZmZlciByYW5nZSBhbmQgY2hlY2sgaWZcbiAgICAgIGNvcnJlc3BvbmRpbmcgcmFuZ2UgaXMgc3RpbGwgYnVmZmVyZWQuIG9ubHkgcHVzaCB0byBuZXcgYXJyYXkgYWxyZWFkeSBidWZmZXJlZCByYW5nZVxuICAgICovXG4gICAgdmFyIG5ld1JhbmdlID0gW10scmFuZ2U7XG4gICAgZm9yIChpID0gMCA7IGkgPCB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCA7IGkrKykge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYodGhpcy5pc0J1ZmZlcmVkKChyYW5nZS5zdGFydCArIHJhbmdlLmVuZCkvMikpIHtcbiAgICAgICAgbmV3UmFuZ2UucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBuZXdSYW5nZTtcblxuICAgIGxvZ2dlci5sb2coJ2J1ZmZlciBmbHVzaGVkJyk7XG4gICAgLy8gZXZlcnl0aGluZyBmbHVzaGVkICFcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gICAgLypcbiAgICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggOlxuICAgICAgIC0gcGF1c2UgcGxheWJhY2sgaWYgcGxheWluZ1xuICAgICAgIC0gY2FuY2VsIGFueSBwZW5kaW5nIGxvYWQgcmVxdWVzdFxuICAgICAgIC0gYW5kIHRyaWdnZXIgYSBidWZmZXIgZmx1c2hcbiAgICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaCgpIHtcbiAgICBsb2dnZXIubG9nKCdpbW1lZGlhdGVMZXZlbFN3aXRjaCcpO1xuICAgIGlmKCF0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSB0cnVlO1xuICAgICAgdGhpcy5wcmV2aW91c2x5UGF1c2VkID0gdGhpcy52aWRlby5wYXVzZWQ7XG4gICAgICB0aGlzLnZpZGVvLnBhdXNlKCk7XG4gICAgfVxuICAgIGlmKHRoaXMuZnJhZyAmJiB0aGlzLmZyYWcubG9hZGVyKSB7XG4gICAgICB0aGlzLmZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuZnJhZz1udWxsO1xuICAgIC8vIGZsdXNoIGV2ZXJ5dGhpbmdcbiAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goeyBzdGFydCA6IDAsIGVuZCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgIC8vIHRyaWdnZXIgYSBzb3VyY2VCdWZmZXIgZmx1c2hcbiAgICB0aGlzLnN0YXRlID0gdGhpcy5CVUZGRVJfRkxVU0hJTkc7XG4gICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICB0aGlzLmZyYWdMb2FkSWR4Kz0yKnRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4vKlxuICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCBlbmQsIGFmdGVyIG5ldyBmcmFnbWVudCBoYXMgYmVlbiBidWZmZXJlZCA6XG4gICAgLSBudWRnZSB2aWRlbyBkZWNvZGVyIGJ5IHNsaWdodGx5IGFkanVzdGluZyB2aWRlbyBjdXJyZW50VGltZVxuICAgIC0gcmVzdW1lIHRoZSBwbGF5YmFjayBpZiBuZWVkZWRcbiovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCkge1xuICAgIHRoaXMuaW1tZWRpYXRlU3dpdGNoID0gZmFsc2U7XG4gICAgdGhpcy52aWRlby5jdXJyZW50VGltZS09MC4wMDAxO1xuICAgIGlmKCF0aGlzLnByZXZpb3VzbHlQYXVzZWQpIHtcbiAgICAgIHRoaXMudmlkZW8ucGxheSgpO1xuICAgIH1cbiAgfVxuXG4gIG5leHRMZXZlbFN3aXRjaCgpIHtcbiAgICAvKiB0cnkgdG8gc3dpdGNoIEFTQVAgd2l0aG91dCBicmVha2luZyB2aWRlbyBwbGF5YmFjayA6XG4gICAgICAgaW4gb3JkZXIgdG8gZW5zdXJlIHNtb290aCBidXQgcXVpY2sgbGV2ZWwgc3dpdGNoaW5nLFxuICAgICAgd2UgbmVlZCB0byBmaW5kIHRoZSBuZXh0IGZsdXNoYWJsZSBidWZmZXIgcmFuZ2VcbiAgICAgIHdlIHNob3VsZCB0YWtlIGludG8gYWNjb3VudCBuZXcgc2VnbWVudCBmZXRjaCB0aW1lXG4gICAgKi9cbiAgICB2YXIgZmV0Y2hkZWxheSxjdXJyZW50UmFuZ2UsbmV4dFJhbmdlO1xuXG4gICAgY3VycmVudFJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKTtcbiAgICBpZihjdXJyZW50UmFuZ2UpIHtcbiAgICAvLyBmbHVzaCBidWZmZXIgcHJlY2VkaW5nIGN1cnJlbnQgZnJhZ21lbnQgKGZsdXNoIHVudGlsIGN1cnJlbnQgZnJhZ21lbnQgc3RhcnQgb2Zmc2V0KVxuICAgIC8vIG1pbnVzIDFzIHRvIGF2b2lkIHZpZGVvIGZyZWV6aW5nLCB0aGF0IGNvdWxkIGhhcHBlbiBpZiB3ZSBmbHVzaCBrZXlmcmFtZSBvZiBjdXJyZW50IHZpZGVvIC4uLlxuICAgICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goeyBzdGFydCA6IDAsIGVuZCA6IGN1cnJlbnRSYW5nZS5zdGFydC0xfSk7XG4gICAgfVxuXG4gICAgaWYoIXRoaXMudmlkZW8ucGF1c2VkKSB7XG4gICAgICAvLyBhZGQgYSBzYWZldHkgZGVsYXkgb2YgMXNcbiAgICAgIHZhciBuZXh0TGV2ZWxJZCA9IHRoaXMuaGxzLm5leHRMb2FkTGV2ZWwsbmV4dExldmVsID0gdGhpcy5sZXZlbHNbbmV4dExldmVsSWRdO1xuICAgICAgaWYodGhpcy5obHMuc3RhdHMuZnJhZ0xhc3RLYnBzICYmIHRoaXMuZnJhZykge1xuICAgICAgICBmZXRjaGRlbGF5ID0gdGhpcy5mcmFnLmR1cmF0aW9uKm5leHRMZXZlbC5iaXRyYXRlLygxMDAwKnRoaXMuaGxzLnN0YXRzLmZyYWdMYXN0S2JwcykrMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmZXRjaGRlbGF5OicrZmV0Y2hkZWxheSk7XG4gICAgLy8gZmluZCBidWZmZXIgcmFuZ2UgdGhhdCB3aWxsIGJlIHJlYWNoZWQgb25jZSBuZXcgZnJhZ21lbnQgd2lsbCBiZSBmZXRjaGVkXG4gICAgbmV4dFJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lICsgZmV0Y2hkZWxheSk7XG4gICAgaWYobmV4dFJhbmdlKSB7XG4gICAgICAvLyB3ZSBjYW4gZmx1c2ggYnVmZmVyIHJhbmdlIGZvbGxvd2luZyB0aGlzIG9uZSB3aXRob3V0IHN0YWxsaW5nIHBsYXliYWNrXG4gICAgICBuZXh0UmFuZ2UgPSB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKG5leHRSYW5nZSk7XG4gICAgICBpZihuZXh0UmFuZ2UpIHtcbiAgICAgICAgLy8gZmx1c2ggcG9zaXRpb24gaXMgdGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoaXMgbmV3IGJ1ZmZlclxuICAgICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7IHN0YXJ0IDogbmV4dFJhbmdlLnN0YXJ0LCBlbmQgOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFl9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCkge1xuICAgICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgICAgLy8gdHJpZ2dlciBhIHNvdXJjZUJ1ZmZlciBmbHVzaFxuICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuQlVGRkVSX0ZMVVNISU5HO1xuICAgICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHgrPTIqdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbk1TRUF0dGFjaGVkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLnZpZGVvID0gZGF0YS52aWRlbztcbiAgICB0aGlzLm1lZGlhU291cmNlID0gZGF0YS5tZWRpYVNvdXJjZTtcbiAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9uVmlkZW9TZWVraW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9uVmlkZW9TZWVrZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udm1ldGFkYXRhID0gdGhpcy5vblZpZGVvTWV0YWRhdGEuYmluZCh0aGlzKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLHRoaXMub252c2Vla2luZyk7XG4gICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLHRoaXMub252c2Vla2VkKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJyx0aGlzLm9udm1ldGFkYXRhKTtcbiAgICBpZih0aGlzLmxldmVscyAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uTVNFRGV0YWNoZWQoKSB7XG4gICAgdGhpcy52aWRlbyA9IG51bGw7XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgIHRoaXMuc3RvcCgpO1xuICB9XG5cblxuICBvblZpZGVvU2Vla2luZygpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSB0aGlzLkxPQURJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGN1cnJlbnRseSBsb2FkZWQgZnJhZ21lbnQgaXMgaW5zaWRlIGJ1ZmZlci5cbiAgICAgIC8vaWYgb3V0c2lkZSwgY2FuY2VsIGZyYWdtZW50IGxvYWRpbmcsIG90aGVyd2lzZSBkbyBub3RoaW5nXG4gICAgICBpZih0aGlzLmJ1ZmZlckluZm8odGhpcy52aWRlby5jdXJyZW50VGltZSkubGVuID09PSAwKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ3NlZWtpbmcgb3V0c2lkZSBvZiBidWZmZXIgd2hpbGUgZnJhZ21lbnQgbG9hZCBpbiBwcm9ncmVzcywgY2FuY2VsIGZyYWdtZW50IGxvYWQnKTtcbiAgICAgICAgdGhpcy5mcmFnLmxvYWRlci5hYm9ydCgpO1xuICAgICAgICB0aGlzLmZyYWcgPSBudWxsO1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBsb2FkIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgfVxuICAgIH1cbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IHRoaXMudmlkZW8uY3VycmVudFRpbWU7XG4gICAgfVxuICAgIC8vIGF2b2lkIHJlcG9ydGluZyBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgaW4gY2FzZSB1c2VyIGlzIHNlZWtpbmcgc2V2ZXJhbCB0aW1lcyBvbiBzYW1lIHBvc2l0aW9uXG4gICAgaWYodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmZyYWdMb2FkSWR4Kz0gMip0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgfVxuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgcHJvY2Vzc2luZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25WaWRlb1NlZWtlZCgpIHtcbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIEZSQUdNRU5UX1BMQVlJTkcgdHJpZ2dlcmluZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25WaWRlb01ldGFkYXRhKCkge1xuICAgICAgaWYodGhpcy52aWRlby5jdXJyZW50VGltZSAhPT0gdGhpcy5zdGFydFBvc2l0aW9uKSB7XG4gICAgICAgIHRoaXMudmlkZW8uY3VycmVudFRpbWUgPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgfVxuICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSB0cnVlO1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIGFhYz1mYWxzZSwgaGVhYWM9ZmFsc2UsY29kZWNzO1xuICAgIGRhdGEubGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgLy8gZGV0ZWN0IGlmIHdlIGhhdmUgZGlmZmVyZW50IGtpbmQgb2YgYXVkaW8gY29kZWNzIHVzZWQgYW1vbmdzdCBwbGF5bGlzdHNcbiAgICAgIGNvZGVjcyA9IGxldmVsLmNvZGVjcztcbiAgICAgIGlmKGNvZGVjcykge1xuICAgICAgICBpZihjb2RlY3MuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xKSB7XG4gICAgICAgICAgYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZihjb2RlY3MuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSB7XG4gICAgICAgICAgaGVhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5hdWRpb2NvZGVjc3dpdGNoID0gKGFhYyAmJiBoZWFhYyk7XG4gICAgaWYodGhpcy5hdWRpb2NvZGVjc3dpdGNoKSB7XG4gICAgICBsb2dnZXIubG9nKCdib3RoIEFBQy9IRS1BQUMgYXVkaW8gZm91bmQgaW4gbGV2ZWxzOyBkZWNsYXJpbmcgYXVkaW8gY29kZWMgYXMgSEUtQUFDJyk7XG4gICAgfVxuICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gZmFsc2U7XG4gICAgdGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID0gZmFsc2U7XG4gICAgaWYodGhpcy52aWRlbyAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBuZXdMZXZlbERldGFpbHMgPSBkYXRhLmRldGFpbHMsXG4gICAgICAgIGR1cmF0aW9uID0gbmV3TGV2ZWxEZXRhaWxzLnRvdGFsZHVyYXRpb24sXG4gICAgICAgIG5ld0xldmVsSWQgPSBkYXRhLmxldmVsLFxuICAgICAgICBuZXdMZXZlbCA9IHRoaXMubGV2ZWxzW25ld0xldmVsSWRdLFxuICAgICAgICBjdXJMZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICBzbGlkaW5nID0gMDtcbiAgICBsb2dnZXIubG9nKGBsZXZlbCAke25ld0xldmVsSWR9IGxvYWRlZCBbJHtuZXdMZXZlbERldGFpbHMuc3RhcnRTTn0sJHtuZXdMZXZlbERldGFpbHMuZW5kU059XSxkdXJhdGlvbjoke2R1cmF0aW9ufWApO1xuICAgIC8vIGNoZWNrIGlmIHBsYXlsaXN0IGlzIGFscmVhZHkgbG9hZGVkIChpZiB5ZXMsIGl0IHNob3VsZCBiZSBhIGxpdmUgcGxheWxpc3QpXG4gICAgaWYoY3VyTGV2ZWwgJiYgY3VyTGV2ZWwuZGV0YWlscyAmJiBjdXJMZXZlbC5kZXRhaWxzLmxpdmUpIHtcbiAgICAgIHZhciBjdXJMZXZlbERldGFpbHMgPSBjdXJMZXZlbC5kZXRhaWxzO1xuICAgICAgLy8gIHBsYXlsaXN0IHNsaWRpbmcgaXMgdGhlIHN1bSBvZiA6IGN1cnJlbnQgcGxheWxpc3Qgc2xpZGluZyArIHNsaWRpbmcgb2YgbmV3IHBsYXlsaXN0IGNvbXBhcmVkIHRvIGN1cnJlbnQgb25lXG4gICAgICAvLyBjaGVjayBzbGlkaW5nIG9mIHVwZGF0ZWQgcGxheWxpc3QgYWdhaW5zdCBjdXJyZW50IG9uZSA6XG4gICAgICAvLyBhbmQgZmluZCBpdHMgcG9zaXRpb24gaW4gY3VycmVudCBwbGF5bGlzdFxuICAgICAgLy9sb2dnZXIubG9nKFwiZnJhZ21lbnRzWzBdLnNuL3RoaXMubGV2ZWwvY3VyTGV2ZWwuZGV0YWlscy5mcmFnbWVudHNbMF0uc246XCIgKyBmcmFnbWVudHNbMF0uc24gKyBcIi9cIiArIHRoaXMubGV2ZWwgKyBcIi9cIiArIGN1ckxldmVsLmRldGFpbHMuZnJhZ21lbnRzWzBdLnNuKTtcbiAgICAgIHZhciBTTmRpZmYgPSBuZXdMZXZlbERldGFpbHMuc3RhcnRTTiAtIGN1ckxldmVsRGV0YWlscy5zdGFydFNOO1xuICAgICAgaWYoU05kaWZmID49MCkge1xuICAgICAgICAvLyBwb3NpdGl2ZSBzbGlkaW5nIDogbmV3IHBsYXlsaXN0IHNsaWRpbmcgd2luZG93IGlzIGFmdGVyIHByZXZpb3VzIG9uZVxuICAgICAgICB2YXIgb2xkZnJhZ21lbnRzID0gY3VyTGV2ZWxEZXRhaWxzLmZyYWdtZW50cztcbiAgICAgICAgaWYoIFNOZGlmZiA8IG9sZGZyYWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICBzbGlkaW5nID0gY3VyTGV2ZWxEZXRhaWxzLnNsaWRpbmcgKyBvbGRmcmFnbWVudHNbU05kaWZmXS5zdGFydDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBjYW5ub3QgY29tcHV0ZSBzbGlkaW5nLCBubyBTTiBpbiBjb21tb24gYmV0d2VlbiBvbGQvbmV3IGxldmVsOlske2N1ckxldmVsRGV0YWlscy5zdGFydFNOfSwke2N1ckxldmVsRGV0YWlscy5lbmRTTn1dL1ske25ld0xldmVsRGV0YWlscy5zdGFydFNOfSwke25ld0xldmVsRGV0YWlscy5lbmRTTn1dYCk7XG4gICAgICAgICAgc2xpZGluZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbmVnYXRpdmUgc2xpZGluZzogbmV3IHBsYXlsaXN0IHNsaWRpbmcgd2luZG93IGlzIGJlZm9yZSBwcmV2aW91cyBvbmVcbiAgICAgICAgc2xpZGluZyA9IGN1ckxldmVsRGV0YWlscy5zbGlkaW5nIC0gbmV3TGV2ZWxEZXRhaWxzLmZyYWdtZW50c1stU05kaWZmXS5zdGFydDtcbiAgICAgIH1cbiAgICAgIGlmKHNsaWRpbmcpIHtcbiAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCBzbGlkaW5nOiR7c2xpZGluZy50b0ZpeGVkKDMpfWApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBvdmVycmlkZSBsZXZlbCBpbmZvXG4gICAgbmV3TGV2ZWwuZGV0YWlscyA9IG5ld0xldmVsRGV0YWlscztcbiAgICBuZXdMZXZlbC5kZXRhaWxzLnNsaWRpbmcgPSBzbGlkaW5nO1xuICAgIGlmKHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3QsIHNldCBzdGFydCBwb3NpdGlvbiB0byBiZSBmcmFnbWVudCBOLTNcbiAgICAgIGlmKG5ld0xldmVsRGV0YWlscy5saXZlKSB7XG4gICAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IE1hdGgubWF4KDAsZHVyYXRpb24gLSAzICogbmV3TGV2ZWxEZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IHRydWU7XG4gICAgfVxuICAgIC8vIG9ubHkgc3dpdGNoIGJhdGNrIHRvIElETEUgc3RhdGUgaWYgd2Ugd2VyZSB3YWl0aW5nIGZvciBsZXZlbCB0byBzdGFydCBkb3dubG9hZGluZyBhIG5ldyBmcmFnbWVudFxuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuV0FJVElOR19MRVZFTCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgICB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSB0aGlzLkxPQURJTkcpIHtcbiAgICAgIGlmKHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIC4uLiB3ZSBqdXN0IGxvYWRlZCBhIGZyYWdtZW50IHRvIGRldGVybWluZSBhZGVxdWF0ZSBzdGFydCBiaXRyYXRlIGFuZCBpbml0aWFsaXplIGF1dG9zd2l0Y2ggYWxnb1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgICB0aGlzLmZyYWdtZW50Qml0cmF0ZVRlc3QgPSBmYWxzZTtcbiAgICAgICAgZGF0YS5zdGF0cy50cGFyc2VkID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgPSBuZXcgRGF0ZSgpO1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHsgc3RhdHMgOiBkYXRhLnN0YXRzLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5QQVJTSU5HO1xuICAgICAgICAvLyB0cmFuc211eCB0aGUgTVBFRy1UUyBkYXRhIHRvIElTTy1CTUZGIHNlZ21lbnRzXG4gICAgICAgIHRoaXMuc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgICAgICB2YXIgY3VycmVudExldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0sIGRldGFpbHMgPSBjdXJyZW50TGV2ZWwuZGV0YWlscywgIGR1cmF0aW9uID0gIGRldGFpbHMudG90YWxkdXJhdGlvbiwgc3RhcnQgPSB0aGlzLmZyYWcuc3RhcnQ7XG4gICAgICAgIGlmKGRldGFpbHMubGl2ZSkge1xuICAgICAgICAgIGR1cmF0aW9uKz1kZXRhaWxzLnNsaWRpbmc7XG4gICAgICAgICAgc3RhcnQrPWRldGFpbHMuc2xpZGluZztcbiAgICAgICAgfVxuICAgICAgICBpZih0aGlzLmZyYWcuZHJpZnQpIHtcbiAgICAgICAgICBzdGFydCs9IHRoaXMuZnJhZy5kcmlmdDtcbiAgICAgICAgfVxuICAgICAgICBsb2dnZXIubG9nKGBEZW11eGluZyAgICAgICR7dGhpcy5mcmFnLnNufSBvZiBbJHtkZXRhaWxzLnN0YXJ0U059ICwke2RldGFpbHMuZW5kU059XSxsZXZlbCAke3RoaXMubGV2ZWx9YCk7XG4gICAgICAgIHRoaXMuZGVtdXhlci5wdXNoKGRhdGEucGF5bG9hZCxjdXJyZW50TGV2ZWwuYXVkaW9Db2RlYyxjdXJyZW50TGV2ZWwudmlkZW9Db2RlYyxzdGFydCx0aGlzLmZyYWcuY2MsIHRoaXMubGV2ZWwsIGR1cmF0aW9uKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkluaXRTZWdtZW50KGV2ZW50LGRhdGEpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSB0aGlzLlBBUlNJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGNvZGVjcyBoYXZlIGJlZW4gZXhwbGljaXRlbHkgZGVmaW5lZCBpbiB0aGUgbWFzdGVyIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsO1xuICAgICAgLy8gaWYgeWVzIHVzZSB0aGVzZSBvbmVzIGluc3RlYWQgb2YgdGhlIG9uZXMgcGFyc2VkIGZyb20gdGhlIGRlbXV4XG4gICAgICB2YXIgYXVkaW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS52aWRlb0NvZGVjLHNiO1xuICAgICAgLy9sb2dnZXIubG9nKCdwbGF5bGlzdCBsZXZlbCBBL1YgY29kZWNzOicgKyBhdWRpb0NvZGVjICsgJywnICsgdmlkZW9Db2RlYyk7XG4gICAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGNvZGVjczonICsgY29kZWMpO1xuICAgICAgLy8gaWYgcGxheWxpc3QgZG9lcyBub3Qgc3BlY2lmeSBjb2RlY3MsIHVzZSBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudFxuICAgICAgaWYoYXVkaW9Db2RlYyA9PT0gdW5kZWZpbmVkIHx8IGRhdGEuYXVkaW9jb2RlYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgICB9XG4gICAgICBpZih2aWRlb0NvZGVjID09PSB1bmRlZmluZWQgIHx8IGRhdGEudmlkZW9jb2RlYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgICB9XG4gICAgICAvLyBpbiBjYXNlIHNldmVyYWwgYXVkaW8gY29kZWNzIG1pZ2h0IGJlIHVzZWQsIGZvcmNlIEhFLUFBQyBmb3IgYXVkaW8gKHNvbWUgYnJvd3NlcnMgZG9uJ3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2gpXG4gICAgICAvL2Rvbid0IGRvIGl0IGZvciBtb25vIHN0cmVhbXMgLi4uXG4gICAgICBpZih0aGlzLmF1ZGlvY29kZWNzd2l0Y2ggJiYgZGF0YS5hdWRpb0NoYW5uZWxDb3VudCA9PT0gMiAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYW5kcm9pZCcpID09PSAtMSAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpID09PSAtMSkge1xuICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICB9XG4gICAgICBpZighdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSB7fTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgc2VsZWN0ZWQgQS9WIGNvZGVjcyBmb3Igc291cmNlQnVmZmVyczoke2F1ZGlvQ29kZWN9LCR7dmlkZW9Db2RlY31gKTtcbiAgICAgICAgLy8gY3JlYXRlIHNvdXJjZSBCdWZmZXIgYW5kIGxpbmsgdGhlbSB0byBNZWRpYVNvdXJjZVxuICAgICAgICBpZihhdWRpb0NvZGVjKSB7XG4gICAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyA9IHRoaXMubWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKGB2aWRlby9tcDQ7Y29kZWNzPSR7YXVkaW9Db2RlY31gKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfVxuICAgICAgICBpZih2aWRlb0NvZGVjKSB7XG4gICAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlci52aWRlbyA9IHRoaXMubWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKGB2aWRlby9tcDQ7Y29kZWNzPSR7dmlkZW9Db2RlY31gKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYoYXVkaW9Db2RlYykge1xuICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogJ2F1ZGlvJywgZGF0YSA6IGRhdGEuYXVkaW9Nb292fSk7XG4gICAgICB9XG4gICAgICBpZih2aWRlb0NvZGVjKSB7XG4gICAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiAndmlkZW8nLCBkYXRhIDogZGF0YS52aWRlb01vb3Z9KTtcbiAgICAgIH1cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnbWVudFBhcnNpbmcoZXZlbnQsZGF0YSkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuUEFSU0lORykge1xuICAgICAgdGhpcy50cGFyc2UyID0gRGF0ZS5ub3coKTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgaWYobGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICAgIHZhciBmcmFnbWVudHMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5kZXRhaWxzLmZyYWdtZW50cztcbiAgICAgICAgdmFyIHNuMCA9IGZyYWdtZW50c1swXS5zbixzbjEgPSBmcmFnbWVudHNbZnJhZ21lbnRzLmxlbmd0aC0xXS5zbiwgc24gPSB0aGlzLmZyYWcuc247XG4gICAgICAgIC8vcmV0cmlldmUgdGhpcy5mcmFnLnNuIGluIHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdXG4gICAgICAgIGlmKHNuID49IHNuMCAmJiBzbiA8PSBzbjEpIHtcbiAgICAgICAgICBsZXZlbC5kZXRhaWxzLnNsaWRpbmcgPSBkYXRhLnN0YXJ0UFRTIC0gZnJhZ21lbnRzW3NuLXNuMF0uc3RhcnQ7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0IHNsaWRpbmc6JHtsZXZlbC5kZXRhaWxzLnNsaWRpbmcudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbG9nZ2VyLmxvZyhgICAgICAgcGFyc2VkIGRhdGEsIHR5cGUvc3RhcnRQVFMvZW5kUFRTL3N0YXJ0RFRTL2VuZERUUy9uYjoke2RhdGEudHlwZX0vJHtkYXRhLnN0YXJ0UFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5lbmRQVFMudG9GaXhlZCgzKX0vJHtkYXRhLnN0YXJ0RFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5lbmREVFMudG9GaXhlZCgzKX0vJHtkYXRhLm5ifWApO1xuICAgICAgLy90aGlzLmZyYWcuZHJpZnQ9ZGF0YS5zdGFydFBUUy10aGlzLmZyYWcuc3RhcnQ7XG4gICAgICB0aGlzLmZyYWcuZHJpZnQ9MDtcbiAgICAgIC8vIGlmKGxldmVsLmRldGFpbHMuc2xpZGluZykge1xuICAgICAgLy8gICB0aGlzLmZyYWcuZHJpZnQtPWxldmVsLmRldGFpbHMuc2xpZGluZztcbiAgICAgIC8vIH1cbiAgICAgIC8vbG9nZ2VyLmxvZyhgICAgICAgZHJpZnQ6JHt0aGlzLmZyYWcuZHJpZnQudG9GaXhlZCgzKX1gKTtcbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiBkYXRhLnR5cGUsIGRhdGEgOiBkYXRhLm1vb2Z9KTtcbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiBkYXRhLnR5cGUsIGRhdGEgOiBkYXRhLm1kYXR9KTtcbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IGRhdGEuZW5kUFRTO1xuICAgICAgdGhpcy5idWZmZXJSYW5nZS5wdXNoKHt0eXBlIDogZGF0YS50eXBlLCBzdGFydCA6IGRhdGEuc3RhcnRQVFMsIGVuZCA6IGRhdGEuZW5kUFRTLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgICAvLyBpZihkYXRhLnR5cGUgPT09ICd2aWRlbycpIHtcbiAgICAgIC8vICAgdGhpcy5mcmFnLmZwc0V4cGVjdGVkID0gKGRhdGEubmItMSkgLyAoZGF0YS5lbmRQVFMgLSBkYXRhLnN0YXJ0UFRTKTtcbiAgICAgIC8vIH1cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKGBub3QgaW4gUEFSU0lORyBzdGF0ZSwgZGlzY2FyZGluZyAke2V2ZW50fWApO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ21lbnRQYXJzZWQoKSB7XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gdGhpcy5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnN0YXRlID0gdGhpcy5QQVJTRUQ7XG4gICAgICB0aGlzLnN0YXRzLnRwYXJzZWQgPSBuZXcgRGF0ZSgpO1xuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkVycm9yKGV2ZW50LGRhdGEpIHtcbiAgICBzd2l0Y2goZGF0YS5kZXRhaWxzKSB7XG4gICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIG9uIGVycm9yc1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ6XG4gICAgICAgIC8vIGlmIGZhdGFsIGVycm9yLCBzdG9wIHByb2Nlc3NpbmcsIG90aGVyd2lzZSBtb3ZlIHRvIElETEUgdG8gcmV0cnkgbG9hZGluZ1xuICAgICAgICBsb2dnZXIud2FybihgYnVmZmVyIGNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSB3aGlsZSBsb2FkaW5nIGZyYWcsc3dpdGNoIHRvICR7ZGF0YS5mYXRhbCA/ICdFUlJPUicgOiAnSURMRSd9IHN0YXRlIC4uLmApO1xuICAgICAgICB0aGlzLnN0YXRlID0gZGF0YS5mYXRhbCA/IHRoaXMuRVJST1IgOiB0aGlzLklETEU7XG4gICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgb25Tb3VyY2VCdWZmZXJVcGRhdGVFbmQoKSB7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gdGhpcy5BUFBFTkRJTkcgJiYgdGhpcy5tcDRzZWdtZW50cy5sZW5ndGggPT09IDApICB7XG4gICAgICBpZih0aGlzLmZyYWcpIHtcbiAgICAgICAgdGhpcy5zdGF0cy50YnVmZmVyZWQgPSBuZXcgRGF0ZSgpO1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHsgc3RhdHMgOiB0aGlzLnN0YXRzLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25Tb3VyY2VCdWZmZXJFcnJvcihldmVudCkge1xuICAgICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtldmVudH1gKTtcbiAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLkVSUk9SO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfQVBQRU5ESU5HX0VSUk9SLCBmYXRhbDp0cnVlLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnVmZmVyQ29udHJvbGxlcjtcbiIsIi8qXG4gKiBsZXZlbCBjb250cm9sbGVyXG4gKlxuICovXG5cbiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCB7RXJyb3JUeXBlcyxFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBMZXZlbENvbnRyb2xsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25tbCA9IHRoaXMub25NYW5pZmVzdExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbHAgPSB0aGlzLm9uRnJhZ21lbnRMb2FkUHJvZ3Jlc3MuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZXJyID0gdGhpcy5vbkVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FEX1BST0dSRVNTLCB0aGlzLm9uZmxwKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRVJST1IsIHRoaXMub25lcnIpO1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB0aGlzLm9ubWwpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHRoaXMub25mbHApO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgfVxuICAgIHRoaXMuX21hbnVhbExldmVsID0gLTE7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgbGV2ZWxzID0gW10sYml0cmF0ZVN0YXJ0LGksYml0cmF0ZVNldD17fTtcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIHZhciByZWR1bmRhbnRMZXZlbElkID0gYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXTtcbiAgICAgIGlmKHJlZHVuZGFudExldmVsSWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBiaXRyYXRlU2V0W2xldmVsLmJpdHJhdGVdID0gbGV2ZWxzLmxlbmd0aDtcbiAgICAgICAgbGV2ZWwudXJsID0gW2xldmVsLnVybF07XG4gICAgICAgIGxldmVsLnVybElkID0gMDtcbiAgICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzW3JlZHVuZGFudExldmVsSWRdLnVybC5wdXNoKGxldmVsLnVybCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gc3RhcnQgYml0cmF0ZSBpcyB0aGUgZmlyc3QgYml0cmF0ZSBvZiB0aGUgbWFuaWZlc3RcbiAgICBiaXRyYXRlU3RhcnQgPSBsZXZlbHNbMF0uYml0cmF0ZTtcbiAgICAvLyBzb3J0IGxldmVsIG9uIGJpdHJhdGVcbiAgICBsZXZlbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgcmV0dXJuIGEuYml0cmF0ZS1iLmJpdHJhdGU7XG4gICAgfSk7XG4gICAgdGhpcy5fbGV2ZWxzID0gbGV2ZWxzO1xuXG4gICAgLy8gZmluZCBpbmRleCBvZiBmaXJzdCBsZXZlbCBpbiBzb3J0ZWQgbGV2ZWxzXG4gICAgZm9yKGk9MDsgaSA8IGxldmVscy5sZW5ndGggOyBpKyspIHtcbiAgICAgIGlmKGxldmVsc1tpXS5iaXRyYXRlID09PSBiaXRyYXRlU3RhcnQpIHtcbiAgICAgICAgdGhpcy5fZmlyc3RMZXZlbCA9IGk7XG4gICAgICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGxvYWRlZCwke2xldmVscy5sZW5ndGh9IGxldmVsKHMpIGZvdW5kLCBmaXJzdCBiaXRyYXRlOiR7Yml0cmF0ZVN0YXJ0fWApO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogdGhpcy5fbGV2ZWxzLFxuICAgICAgICAgICAgICAgICAgICAgIGZpcnN0TGV2ZWwgOiB0aGlzLl9maXJzdExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogZGF0YS5zdGF0c1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbHM7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsIHx8IHRoaXMuX2xldmVsc1tuZXdMZXZlbF0uZGV0YWlscyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpO1xuICAgIH1cbiAgfVxuXG4gc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCkge1xuICAgIC8vIGNoZWNrIGlmIGxldmVsIGlkeCBpcyB2YWxpZFxuICAgIGlmKG5ld0xldmVsID49IDAgJiYgbmV3TGV2ZWwgPCB0aGlzLl9sZXZlbHMubGVuZ3RoKSB7XG4gICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgIGxvZ2dlci5sb2coYHN3aXRjaGluZyB0byBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9TV0lUQ0gsIHsgbGV2ZWwgOiBuZXdMZXZlbH0pO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW25ld0xldmVsXTtcbiAgICAgICAvLyBjaGVjayBpZiB3ZSBuZWVkIHRvIGxvYWQgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWxcbiAgICAgIGlmKGxldmVsLmRldGFpbHMgPT09IHVuZGVmaW5lZCB8fCBsZXZlbC5kZXRhaWxzLmxpdmUgPT09IHRydWUpIHtcbiAgICAgICAgLy8gbGV2ZWwgbm90IHJldHJpZXZlZCB5ZXQsIG9yIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byAocmUpbG9hZCBpdFxuICAgICAgICBsb2dnZXIubG9nKGAocmUpbG9hZGluZyBwbGF5bGlzdCBmb3IgbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgICAgdmFyIHVybElkID0gbGV2ZWwudXJsSWQ7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywgeyB1cmwgOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbCA6IG5ld0xldmVsLCBpZCA6IHVybElkfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGludmFsaWQgbGV2ZWwgaWQgZ2l2ZW4sIHRyaWdnZXIgZXJyb3JcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHsgdHlwZSA6IEVycm9yVHlwZXMuT1RIRVJfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5MRVZFTF9TV0lUQ0hfRVJST1IsIGxldmVsIDogbmV3TGV2ZWwsIGZhdGFsOmZhbHNlLCByZWFzb246ICdpbnZhbGlkIGxldmVsIGlkeCd9KTtcbiAgICB9XG4gfVxuXG5cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgfVxuXG4gIHNldCBtYW51YWxMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgaWYobmV3TGV2ZWwgIT09LTEpIHtcbiAgICAgIHRoaXMubGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB9XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICB9XG5cbiAgLyoqIHNldCB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBzZXQgYXV0b0xldmVsQ2FwcGluZyhuZXdMZXZlbCkge1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICB9XG5cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICBpZih0aGlzLl9zdGFydExldmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhcnRMZXZlbDtcbiAgICB9XG4gIH1cblxuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX3N0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkUHJvZ3Jlc3MoZXZlbnQsZGF0YSkge1xuICAgIHZhciBzdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgaWYoc3RhdHMuYWJvcnRlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gKG5ldyBEYXRlKCkgLSBzdGF0cy50cmVxdWVzdCkvMTAwMDtcbiAgICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICB0aGlzLmxhc3RidyA9IHN0YXRzLmxvYWRlZCo4L3RoaXMubGFzdGZldGNoZHVyYXRpb247XG4gICAgICAvL2NvbnNvbGUubG9nKGBmZXRjaER1cmF0aW9uOiR7dGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbn0sYnc6JHsodGhpcy5sYXN0YncvMTAwMCkudG9GaXhlZCgwKX0vJHtzdGF0cy5hYm9ydGVkfWApO1xuICAgIH1cbiAgfVxuXG4gIG9uRXJyb3IoZXZlbnQsZGF0YSkge1xuICAgIHZhciBkZXRhaWxzID0gZGF0YS5kZXRhaWxzLGxldmVsSWQsbGV2ZWw7XG4gICAgLy8gdHJ5IHRvIHJlY292ZXIgbm90IGZhdGFsIGVycm9yc1xuICAgIHN3aXRjaChkZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgICAgbGV2ZWxJZCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgICAgbGV2ZWxJZCA9IGRhdGEubGV2ZWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8qIHRyeSB0byBzd2l0Y2ggdG8gYSByZWR1bmRhbnQgc3RyZWFtIGlmIGFueSBhdmFpbGFibGUuXG4gICAgICogaWYgbm8gcmVkdW5kYW50IHN0cmVhbSBhdmFpbGFibGUsIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAoaWYgaW4gYXV0byBtb2RlIGFuZCBjdXJyZW50IGxldmVsIG5vdCAwKVxuICAgICAqIG90aGVyd2lzZSwgd2UgY2Fubm90IHJlY292ZXIgdGhpcyBuZXR3b3JrIGVycm9yIC4uLi5cbiAgICAgKi9cbiAgICBpZihsZXZlbElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdO1xuICAgICAgaWYobGV2ZWwudXJsSWQgPCBsZXZlbC51cmwubGVuZ3RoLTEpIHtcbiAgICAgICAgbGV2ZWwudXJsSWQrKztcbiAgICAgICAgbGV2ZWwuZGV0YWlscyA9IHVuZGVmaW5lZDtcbiAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBmb3IgbGV2ZWwgJHtsZXZlbElkfTogc3dpdGNoaW5nIHRvIHJlZHVuZGFudCBzdHJlYW0gaWQgJHtsZXZlbC51cmxJZH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHdlIGNvdWxkIHRyeSB0byByZWNvdmVyIGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgbG93ZXN0IGxldmVsICgwKVxuICAgICAgICBsZXQgcmVjb3ZlcmFibGUgPSAoKHRoaXMuX21hbnVhbExldmVsID09PSAtMSkgJiYgbGV2ZWxJZCk7XG4gICAgICAgIGlmKHJlY292ZXJhYmxlKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfTogZW1lcmdlbmN5IHN3aXRjaC1kb3duIGZvciBuZXh0IGZyYWdtZW50YCk7XG4gICAgICAgICAgdGhpcy5sYXN0YncgPSAwO1xuICAgICAgICAgIHRoaXMubGFzdGZldGNoZHVyYXRpb24gPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgY2Fubm90IHJlY292ZXIgJHtkZXRhaWxzfSBlcnJvcmApO1xuICAgICAgICAgIHRoaXMuX2xldmVsID0gdW5kZWZpbmVkO1xuICAgICAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgICAgICAgIC8vIHJlZGlzcGF0Y2ggc2FtZSBlcnJvciBidXQgd2l0aCBmYXRhbCBzZXQgdG8gdHJ1ZVxuICAgICAgICAgICAgZGF0YS5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKGV2ZW50LGRhdGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgcGxheWxpc3QgaXMgYSBsaXZlIHBsYXlsaXN0XG4gICAgaWYoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwKmRhdGEuZGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgbGV2ZWxJZCA9IHRoaXMuX2xldmVsO1xuICAgIGlmKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdLCB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7IHVybDogbGV2ZWwudXJsW3VybElkXSwgbGV2ZWwgOiBsZXZlbElkLCBpZCA6IHVybElkIH0pO1xuICAgIH1cbiAgfVxuXG4gIG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgaWYodGhpcy5fbWFudWFsTGV2ZWwgIT09IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgcmV0dXJuIHRoaXMubmV4dEF1dG9MZXZlbCgpO1xuICAgIH1cbiAgfVxuXG4gIG5leHRBdXRvTGV2ZWwoKSB7XG4gICAgdmFyIGxhc3RidyA9IHRoaXMubGFzdGJ3LGFkanVzdGVkYncsaSxtYXhBdXRvTGV2ZWw7XG4gICAgaWYodGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9PT0gLTEpIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2xldmVscy5sZW5ndGgtMTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWF4QXV0b0xldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgICB9XG4gICAgLy8gZm9sbG93IGFsZ29yaXRobSBjYXB0dXJlZCBmcm9tIHN0YWdlZnJpZ2h0IDpcbiAgICAvLyBodHRwczovL2FuZHJvaWQuZ29vZ2xlc291cmNlLmNvbS9wbGF0Zm9ybS9mcmFtZXdvcmtzL2F2LysvbWFzdGVyL21lZGlhL2xpYnN0YWdlZnJpZ2h0L2h0dHBsaXZlL0xpdmVTZXNzaW9uLmNwcFxuICAgIC8vIFBpY2sgdGhlIGhpZ2hlc3QgYmFuZHdpZHRoIHN0cmVhbSBiZWxvdyBvciBlcXVhbCB0byBlc3RpbWF0ZWQgYmFuZHdpZHRoLlxuICAgIGZvcihpID0wOyBpIDw9IG1heEF1dG9MZXZlbCA7IGkrKykge1xuICAgIC8vIGNvbnNpZGVyIG9ubHkgODAlIG9mIHRoZSBhdmFpbGFibGUgYmFuZHdpZHRoLCBidXQgaWYgd2UgYXJlIHN3aXRjaGluZyB1cCxcbiAgICAvLyBiZSBldmVuIG1vcmUgY29uc2VydmF0aXZlICg3MCUpIHRvIGF2b2lkIG92ZXJlc3RpbWF0aW5nIGFuZCBpbW1lZGlhdGVseVxuICAgIC8vIHN3aXRjaGluZyBiYWNrLlxuICAgICAgaWYoaSA8PSB0aGlzLl9sZXZlbCkge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC44Kmxhc3RidztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjcqbGFzdGJ3O1xuICAgICAgfVxuICAgICAgaWYoYWRqdXN0ZWRidyA8IHRoaXMuX2xldmVsc1tpXS5iaXRyYXRlKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLGktMSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpLTE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxDb250cm9sbGVyO1xuIiwiIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBUU0RlbXV4ZXIgICAgICAgICAgICBmcm9tICcuL3RzZGVtdXhlcic7XG4gaW1wb3J0IFRTRGVtdXhlcldvcmtlciAgICAgIGZyb20gJy4vdHNkZW11eGVyd29ya2VyJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5cbmNsYXNzIERlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmKGNvbmZpZy5lbmFibGVXb3JrZXIgJiYgKHR5cGVvZihXb3JrZXIpICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnVFMgZGVtdXhpbmcgaW4gd2Vid29ya2VyJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIHdvcmsgPSByZXF1aXJlKCd3ZWJ3b3JraWZ5Jyk7XG4gICAgICAgICAgdGhpcy53ID0gd29yayhUU0RlbXV4ZXJXb3JrZXIpO1xuICAgICAgICAgIHRoaXMub253bXNnID0gdGhpcy5vbldvcmtlck1lc3NhZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgICB0aGlzLncuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgICAgICB0aGlzLncucG9zdE1lc3NhZ2UoeyBjbWQgOiAnaW5pdCd9KTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoJ2Vycm9yIHdoaWxlIGluaXRpYWxpemluZyBUU0RlbXV4ZXJXb3JrZXIsIGZhbGxiYWNrIG9uIHJlZ3VsYXIgVFNEZW11eGVyJyk7XG4gICAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IFRTRGVtdXhlcigpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgICB9XG4gICAgICB0aGlzLmRlbXV4SW5pdGlhbGl6ZWQgPSB0cnVlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLncpIHtcbiAgICAgIHRoaXMudy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJyx0aGlzLm9ud21zZyk7XG4gICAgICB0aGlzLncudGVybWluYXRlKCk7XG4gICAgICB0aGlzLncgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBkdXJhdGlvbikge1xuICAgIGlmKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ2RlbXV4JyAsIGRhdGEgOiBkYXRhLCBhdWRpb0NvZGVjIDogYXVkaW9Db2RlYywgdmlkZW9Db2RlYzogdmlkZW9Db2RlYywgdGltZU9mZnNldCA6IHRpbWVPZmZzZXQsIGNjOiBjYywgbGV2ZWwgOiBsZXZlbCwgZHVyYXRpb24gOiBkdXJhdGlvbn0sW2RhdGFdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZGF0YSksIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgZHVyYXRpb24pO1xuICAgICAgdGhpcy5kZW11eGVyLmVuZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZXYuZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGV2LmRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBpZihldi5kYXRhLmF1ZGlvTW9vdikge1xuICAgICAgICAgIG9iai5hdWRpb01vb3YgPSBuZXcgVWludDhBcnJheShldi5kYXRhLmF1ZGlvTW9vdik7XG4gICAgICAgICAgb2JqLmF1ZGlvQ29kZWMgPSBldi5kYXRhLmF1ZGlvQ29kZWM7XG4gICAgICAgICAgb2JqLmF1ZGlvQ2hhbm5lbENvdW50ID0gZXYuZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgICAgfVxuICAgICAgICBpZihldi5kYXRhLnZpZGVvTW9vdikge1xuICAgICAgICAgIG9iai52aWRlb01vb3YgPSBuZXcgVWludDhBcnJheShldi5kYXRhLnZpZGVvTW9vdik7XG4gICAgICAgICAgb2JqLnZpZGVvQ29kZWMgPSBldi5kYXRhLnZpZGVvQ29kZWM7XG4gICAgICAgICAgb2JqLnZpZGVvV2lkdGggPSBldi5kYXRhLnZpZGVvV2lkdGg7XG4gICAgICAgICAgb2JqLnZpZGVvSGVpZ2h0ID0gZXYuZGF0YS52aWRlb0hlaWdodDtcbiAgICAgICAgfVxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIG9iaik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfREFUQTpcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICAgICAgbW9vZiA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubW9vZiksXG4gICAgICAgICAgbWRhdCA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubWRhdCksXG4gICAgICAgICAgc3RhcnRQVFMgOiBldi5kYXRhLnN0YXJ0UFRTLFxuICAgICAgICAgIGVuZFBUUyA6IGV2LmRhdGEuZW5kUFRTLFxuICAgICAgICAgIHN0YXJ0RFRTIDogZXYuZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFMgOiBldi5kYXRhLmVuZERUUyxcbiAgICAgICAgICB0eXBlIDogZXYuZGF0YS50eXBlLFxuICAgICAgICAgIG5iIDogZXYuZGF0YS5uYlxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKGV2LmRhdGEuZXZlbnQsZXYuZGF0YS5kYXRhKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBEZW11eGVyO1xuIiwiLyoqXG4gKiBQYXJzZXIgZm9yIGV4cG9uZW50aWFsIEdvbG9tYiBjb2RlcywgYSB2YXJpYWJsZS1iaXR3aWR0aCBudW1iZXIgZW5jb2RpbmdcbiAqIHNjaGVtZSB1c2VkIGJ5IGgyNjQuXG4gKi9cblxuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBFeHBHb2xvbWIge1xuXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIC8vIHRoZSBudW1iZXIgb2YgYnl0ZXMgbGVmdCB0byBleGFtaW5lIGluIHRoaXMuZGF0YVxuICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAvLyB0aGUgY3VycmVudCB3b3JkIGJlaW5nIGV4YW1pbmVkXG4gICAgdGhpcy53b3JkID0gMDsgLy8gOnVpbnRcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJpdHMgbGVmdCB0byBleGFtaW5lIGluIHRoZSBjdXJyZW50IHdvcmRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSAwOyAvLyA6dWludFxuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBsb2FkV29yZCgpIHtcbiAgICB2YXJcbiAgICAgIHBvc2l0aW9uID0gdGhpcy5kYXRhLmJ5dGVMZW5ndGggLSB0aGlzLmJ5dGVzQXZhaWxhYmxlLFxuICAgICAgd29ya2luZ0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCksXG4gICAgICBhdmFpbGFibGVCeXRlcyA9IE1hdGgubWluKDQsIHRoaXMuYnl0ZXNBdmFpbGFibGUpO1xuXG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cblxuICAgIHdvcmtpbmdCeXRlcy5zZXQodGhpcy5kYXRhLnN1YmFycmF5KHBvc2l0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29yZCA9IG5ldyBEYXRhVmlldyh3b3JraW5nQnl0ZXMuYnVmZmVyKS5nZXRVaW50MzIoMCk7XG5cbiAgICAvLyB0cmFjayB0aGUgYW1vdW50IG9mIHRoaXMuZGF0YSB0aGF0IGhhcyBiZWVuIHByb2Nlc3NlZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IGF2YWlsYWJsZUJ5dGVzICogODtcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlIC09IGF2YWlsYWJsZUJ5dGVzO1xuICB9XG5cbiAgLy8gKGNvdW50OmludCk6dm9pZFxuICBza2lwQml0cyhjb3VudCkge1xuICAgIHZhciBza2lwQnl0ZXM7IC8vIDppbnRcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gY291bnQpIHtcbiAgICAgIHRoaXMud29yZCAgICAgICAgICA8PD0gY291bnQ7XG4gICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvdW50IC09IHRoaXMuYml0c0F2YWlsYWJsZTtcbiAgICAgIHNraXBCeXRlcyA9IGNvdW50ID4+IDM7XG5cbiAgICAgIGNvdW50IC09IChza2lwQnl0ZXMgPj4gMyk7XG4gICAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlIC09IHNraXBCeXRlcztcblxuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuXG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH1cbiAgfVxuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy5iaXRzQXZhaWxhYmxlLCBzaXplKSwgLy8gOnVpbnRcbiAgICAgIHZhbHUgPSB0aGlzLndvcmQgPj4+ICgzMiAtIGJpdHMpOyAvLyA6dWludFxuXG4gICAgaWYoc2l6ZSA+MzIpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignQ2Fubm90IHJlYWQgbW9yZSB0aGFuIDMyIGJpdHMgYXQgYSB0aW1lJyk7XG4gICAgfVxuXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGJpdHM7XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMud29yZCA8PD0gYml0cztcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnl0ZXNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgfVxuXG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExaKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDAgOyBsZWFkaW5nWmVyb0NvdW50IDwgdGhpcy5iaXRzQXZhaWxhYmxlIDsgKytsZWFkaW5nWmVyb0NvdW50KSB7XG4gICAgICBpZiAoMCAhPT0gKHRoaXMud29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmQgPDw9IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3ZSBleGhhdXN0ZWQgd29yZCBhbmQgc3RpbGwgaGF2ZSBub3QgZm91bmQgYSAxXG4gICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50ICsgdGhpcy5za2lwTFooKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcFVFRygpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMWigpKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcEVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dWludFxuICByZWFkVUVHKCkge1xuICAgIHZhciBjbHogPSB0aGlzLnNraXBMWigpOyAvLyA6dWludFxuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKGNseiArIDEpIC0gMTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkRUcoKSB7XG4gICAgdmFyIHZhbHUgPSB0aGlzLnJlYWRVRUcoKTsgLy8gOmludFxuICAgIGlmICgweDAxICYgdmFsdSkge1xuICAgICAgLy8gdGhlIG51bWJlciBpcyBvZGQgaWYgdGhlIGxvdyBvcmRlciBiaXQgaXMgc2V0XG4gICAgICByZXR1cm4gKDEgKyB2YWx1KSA+Pj4gMTsgLy8gYWRkIDEgdG8gbWFrZSBpdCBldmVuLCBhbmQgZGl2aWRlIGJ5IDJcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xICogKHZhbHUgPj4+IDEpOyAvLyBkaXZpZGUgYnkgdHdvIHRoZW4gbWFrZSBpdCBuZWdhdGl2ZVxuICAgIH1cbiAgfVxuXG4gIC8vIFNvbWUgY29udmVuaWVuY2UgZnVuY3Rpb25zXG4gIC8vIDpCb29sZWFuXG4gIHJlYWRCb29sZWFuKCkge1xuICAgIHJldHVybiAxID09PSB0aGlzLnJlYWRCaXRzKDEpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVQnl0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyg4KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBFeHBHb2xvbWIgZGVjb2RlciBwYXN0IGEgc2NhbGluZyBsaXN0LiBUaGUgc2NhbGluZ1xuICAgKiBsaXN0IGlzIG9wdGlvbmFsbHkgdHJhbnNtaXR0ZWQgYXMgcGFydCBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlclxuICAgKiBzZXQgYW5kIGlzIG5vdCByZWxldmFudCB0byB0cmFuc211eGluZy5cbiAgICogQHBhcmFtIGNvdW50IHtudW1iZXJ9IHRoZSBudW1iZXIgb2YgZW50cmllcyBpbiB0aGlzIHNjYWxpbmcgbGlzdFxuICAgKiBAc2VlIFJlY29tbWVuZGF0aW9uIElUVS1UIEguMjY0LCBTZWN0aW9uIDcuMy4yLjEuMS4xXG4gICAqL1xuICBza2lwU2NhbGluZ0xpc3QoY291bnQpIHtcbiAgICB2YXJcbiAgICAgIGxhc3RTY2FsZSA9IDgsXG4gICAgICBuZXh0U2NhbGUgPSA4LFxuICAgICAgaixcbiAgICAgIGRlbHRhU2NhbGU7XG5cbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRUcoKTtcbiAgICAgICAgbmV4dFNjYWxlID0gKGxhc3RTY2FsZSArIGRlbHRhU2NhbGUgKyAyNTYpICUgMjU2O1xuICAgICAgfVxuXG4gICAgICBsYXN0U2NhbGUgPSAobmV4dFNjYWxlID09PSAwKSA/IGxhc3RTY2FsZSA6IG5leHRTY2FsZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVhZCBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgYW5kIHJldHVybiBzb21lIGludGVyZXN0aW5nIHZpZGVvXG4gICAqIHByb3BlcnRpZXMuIEEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBpcyB0aGUgSDI2NCBtZXRhZGF0YSB0aGF0XG4gICAqIGRlc2NyaWJlcyB0aGUgcHJvcGVydGllcyBvZiB1cGNvbWluZyB2aWRlbyBmcmFtZXMuXG4gICAqIEBwYXJhbSBkYXRhIHtVaW50OEFycmF5fSB0aGUgYnl0ZXMgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0XG4gICAqIEByZXR1cm4ge29iamVjdH0gYW4gb2JqZWN0IHdpdGggY29uZmlndXJhdGlvbiBwYXJzZWQgZnJvbSB0aGVcbiAgICogc2VxdWVuY2UgcGFyYW1ldGVyIHNldCwgaW5jbHVkaW5nIHRoZSBkaW1lbnNpb25zIG9mIHRoZVxuICAgKiBhc3NvY2lhdGVkIHZpZGVvIGZyYW1lcy5cbiAgICovXG4gIHJlYWRTUFMoKSB7XG4gICAgdmFyXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSAwLFxuICAgICAgcHJvZmlsZUlkYyxwcm9maWxlQ29tcGF0LGxldmVsSWRjLFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlLCBwaWNXaWR0aEluTWJzTWludXMxLFxuICAgICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSxcbiAgICAgIGZyYW1lTWJzT25seUZsYWcsXG4gICAgICBzY2FsaW5nTGlzdENvdW50LFxuICAgICAgaTtcblxuICAgIHRoaXMucmVhZFVCeXRlKCk7XG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vIHByb2ZpbGVfaWRjXG4gICAgcHJvZmlsZUNvbXBhdCA9IHRoaXMucmVhZEJpdHMoNSk7IC8vIGNvbnN0cmFpbnRfc2V0WzAtNF1fZmxhZywgdSg1KVxuICAgIHRoaXMuc2tpcEJpdHMoMyk7IC8vIHJlc2VydmVkX3plcm9fM2JpdHMgdSgzKSxcbiAgICBsZXZlbElkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vbGV2ZWxfaWRjIHUoOClcbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gc2VxX3BhcmFtZXRlcl9zZXRfaWRcblxuICAgIC8vIHNvbWUgcHJvZmlsZXMgaGF2ZSBtb3JlIG9wdGlvbmFsIGRhdGEgd2UgZG9uJ3QgbmVlZFxuICAgIGlmIChwcm9maWxlSWRjID09PSAxMDAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTEwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyMiB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxNDQpIHtcbiAgICAgIHZhciBjaHJvbWFGb3JtYXRJZGMgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGlmIChjaHJvbWFGb3JtYXRJZGMgPT09IDMpIHtcbiAgICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gc2VwYXJhdGVfY29sb3VyX3BsYW5lX2ZsYWdcbiAgICAgIH1cbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfY2hyb21hX21pbnVzOFxuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gcXBwcmltZV95X3plcm9fdHJhbnNmb3JtX2J5cGFzc19mbGFnXG4gICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX21hdHJpeF9wcmVzZW50X2ZsYWdcbiAgICAgICAgc2NhbGluZ0xpc3RDb3VudCA9IChjaHJvbWFGb3JtYXRJZGMgIT09IDMpID8gOCA6IDEyO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc2NhbGluZ0xpc3RDb3VudDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19saXN0X3ByZXNlbnRfZmxhZ1sgaSBdXG4gICAgICAgICAgICBpZiAoaSA8IDYpIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoMTYpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoNjQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBsb2cyX21heF9mcmFtZV9udW1fbWludXM0XG4gICAgdmFyIHBpY09yZGVyQ250VHlwZSA9IHRoaXMucmVhZFVFRygpO1xuXG4gICAgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMCkge1xuICAgICAgdGhpcy5yZWFkVUVHKCk7IC8vbG9nMl9tYXhfcGljX29yZGVyX2NudF9sc2JfbWludXM0XG4gICAgfSBlbHNlIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDEpIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRlbHRhX3BpY19vcmRlcl9hbHdheXNfemVyb19mbGFnXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX25vbl9yZWZfcGljXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3RvcF90b19ib3R0b21fZmllbGRcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlOyBpKyspIHtcbiAgICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9yZWZfZnJhbWVbIGkgXVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBtYXhfbnVtX3JlZl9mcmFtZXNcbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBnYXBzX2luX2ZyYW1lX251bV92YWx1ZV9hbGxvd2VkX2ZsYWdcblxuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG5cbiAgICBmcmFtZU1ic09ubHlGbGFnID0gdGhpcy5yZWFkQml0cygxKTtcbiAgICBpZiAoZnJhbWVNYnNPbmx5RmxhZyA9PT0gMCkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gbWJfYWRhcHRpdmVfZnJhbWVfZmllbGRfZmxhZ1xuICAgIH1cblxuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRpcmVjdF84eDhfaW5mZXJlbmNlX2ZsYWdcbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIGZyYW1lX2Nyb3BwaW5nX2ZsYWdcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBwcm9maWxlSWRjIDogcHJvZmlsZUlkYyxcbiAgICAgIHByb2ZpbGVDb21wYXQgOiBwcm9maWxlQ29tcGF0LFxuICAgICAgbGV2ZWxJZGMgOiBsZXZlbElkYyxcbiAgICAgIHdpZHRoOiAoKHBpY1dpZHRoSW5NYnNNaW51czEgKyAxKSAqIDE2KSAtIGZyYW1lQ3JvcExlZnRPZmZzZXQgKiAyIC0gZnJhbWVDcm9wUmlnaHRPZmZzZXQgKiAyLFxuICAgICAgaGVpZ2h0OiAoKDIgLSBmcmFtZU1ic09ubHlGbGFnKSAqIChwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxICsgMSkgKiAxNikgLSAoZnJhbWVDcm9wVG9wT2Zmc2V0ICogMikgLSAoZnJhbWVDcm9wQm90dG9tT2Zmc2V0ICogMilcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEV4cEdvbG9tYjtcbiIsIi8qKlxuICogQSBzdHJlYW0tYmFzZWQgbXAydHMgdG8gbXA0IGNvbnZlcnRlci4gVGhpcyB1dGlsaXR5IGlzIHVzZWQgdG9cbiAqIGRlbGl2ZXIgbXA0cyB0byBhIFNvdXJjZUJ1ZmZlciBvbiBwbGF0Zm9ybXMgdGhhdCBzdXBwb3J0IG5hdGl2ZVxuICogTWVkaWEgU291cmNlIEV4dGVuc2lvbnMuXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXhwR29sb21iICAgICAgIGZyb20gJy4vZXhwLWdvbG9tYic7XG4vLyBpbXBvcnQgSGV4ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2hleCc7XG4gaW1wb3J0IE1QNCAgICAgICAgICAgICBmcm9tICcuLi9yZW11eC9tcDQtZ2VuZXJhdG9yJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4gaW1wb3J0IHtFcnJvclR5cGVzLEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIFRTRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5sYXN0Q0MgPSAwO1xuICAgIHRoaXMuUEVTX1RJTUVTQ0FMRT05MDAwMDtcbiAgICB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUj00O1xuICAgIHRoaXMuTVA0X1RJTUVTQ0FMRT10aGlzLlBFU19USU1FU0NBTEUvdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLnBtdFBhcnNlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3BtdElkID0gdGhpcy5fYXZjSWQgPSB0aGlzLl9hYWNJZCA9IC0xO1xuICAgIHRoaXMuX2F2Y1RyYWNrID0ge3R5cGUgOiAndmlkZW8nLCBzZXF1ZW5jZU51bWJlciA6IDB9O1xuICAgIHRoaXMuX2FhY1RyYWNrID0ge3R5cGUgOiAnYXVkaW8nLCBzZXF1ZW5jZU51bWJlciA6IDB9O1xuICAgIHRoaXMuX2F2Y1NhbXBsZXMgPSBbXTtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1ID0gMDtcbiAgICB0aGlzLl9hYWNTYW1wbGVzID0gW107XG4gICAgdGhpcy5fYWFjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSxhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLHRpbWVPZmZzZXQsY2MsbGV2ZWwsZHVyYXRpb24pIHtcbiAgICB2YXIgYXZjRGF0YSxhYWNEYXRhLHN0YXJ0LGxlbiA9IGRhdGEubGVuZ3RoLHN0dCxwaWQsYXRmLG9mZnNldDtcbiAgICB0aGlzLmF1ZGlvQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgIHRoaXMudmlkZW9Db2RlYyA9IHZpZGVvQ29kZWM7XG4gICAgdGhpcy50aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgIGlmKGNjICE9PSB0aGlzLmxhc3RDQykge1xuICAgICAgbG9nZ2VyLmxvZyhgZGlzY29udGludWl0eSBkZXRlY3RlZGApO1xuICAgICAgdGhpcy5pbnNlcnREaXNjb250aW51aXR5KCk7XG4gICAgICB0aGlzLmxhc3RDQyA9IGNjO1xuICAgIH0gZWxzZSBpZihsZXZlbCAhPT0gdGhpcy5sYXN0TGV2ZWwpIHtcbiAgICAgIGxvZ2dlci5sb2coYGxldmVsIHN3aXRjaCBkZXRlY3RlZGApO1xuICAgICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgICAgdGhpcy5sYXN0TGV2ZWwgPSBsZXZlbDtcbiAgICB9XG4gICAgdmFyIHBtdFBhcnNlZD10aGlzLnBtdFBhcnNlZCxhdmNJZD10aGlzLl9hdmNJZCxhYWNJZD10aGlzLl9hYWNJZDtcblxuICAgIC8vIGxvb3AgdGhyb3VnaCBUUyBwYWNrZXRzXG4gICAgZm9yKHN0YXJ0ID0gMDsgc3RhcnQgPCBsZW4gOyBzdGFydCArPSAxODgpIHtcbiAgICAgIGlmKGRhdGFbc3RhcnRdID09PSAweDQ3KSB7XG4gICAgICAgIHN0dCA9ICEhKGRhdGFbc3RhcnQrMV0gJiAweDQwKTtcbiAgICAgICAgLy8gcGlkIGlzIGEgMTMtYml0IGZpZWxkIHN0YXJ0aW5nIGF0IHRoZSBsYXN0IGJpdCBvZiBUU1sxXVxuICAgICAgICBwaWQgPSAoKGRhdGFbc3RhcnQrMV0gJiAweDFmKSA8PCA4KSArIGRhdGFbc3RhcnQrMl07XG4gICAgICAgIGF0ZiA9IChkYXRhW3N0YXJ0KzNdICYgMHgzMCkgPj4gNDtcbiAgICAgICAgLy8gaWYgYW4gYWRhcHRpb24gZmllbGQgaXMgcHJlc2VudCwgaXRzIGxlbmd0aCBpcyBzcGVjaWZpZWQgYnkgdGhlIGZpZnRoIGJ5dGUgb2YgdGhlIFRTIHBhY2tldCBoZWFkZXIuXG4gICAgICAgIGlmKGF0ZiA+IDEpIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCs1K2RhdGFbc3RhcnQrNF07XG4gICAgICAgICAgLy8gY29udGludWUgaWYgdGhlcmUgaXMgb25seSBhZGFwdGF0aW9uIGZpZWxkXG4gICAgICAgICAgaWYob2Zmc2V0ID09PSAoc3RhcnQrMTg4KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0KzQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYocG10UGFyc2VkKSB7XG4gICAgICAgICAgaWYocGlkID09PSBhdmNJZCkge1xuICAgICAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgICAgIGlmKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYXZjRGF0YSA9IHtkYXRhOiBbXSxzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgYXZjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsc3RhcnQrMTg4KSk7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuc2l6ZSs9c3RhcnQrMTg4LW9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYocGlkID09PSBhYWNJZCkge1xuICAgICAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgICAgIGlmKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYWFjRGF0YSA9IHtkYXRhOiBbXSxzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgYWFjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsc3RhcnQrMTg4KSk7XG4gICAgICAgICAgICAgIGFhY0RhdGEuc2l6ZSs9c3RhcnQrMTg4LW9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgICBvZmZzZXQgKz0gZGF0YVtvZmZzZXRdICsgMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYocGlkID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBBVChkYXRhLG9mZnNldCk7XG4gICAgICAgICAgfSBlbHNlIGlmKHBpZCA9PT0gdGhpcy5fcG10SWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUE1UKGRhdGEsb2Zmc2V0KTtcbiAgICAgICAgICAgIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjSWQ7XG4gICAgICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY0lkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwgeyB0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOmZhbHNlLCByZWFzb24gOiAnVFMgcGFja2V0IGRpZCBub3Qgc3RhcnQgd2l0aCAweDQ3J30pO1xuICAgICAgfVxuICAgIH1cbiAgLy8gcGFyc2UgbGFzdCBQRVMgcGFja2V0XG4gICAgaWYoYXZjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSkpO1xuICAgIH1cbiAgICBpZihhYWNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgfVxuICB9XG5cbiAgZW5kKCkge1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZighdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVJbml0U2VnbWVudCgpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFWQyBzYW1wbGVzOicgKyB0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYodGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQVZDU2FtcGxlcygpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFBQyBzYW1wbGVzOicgKyB0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYodGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQUFDU2FtcGxlcygpO1xuICAgIH1cbiAgICAvL25vdGlmeSBlbmQgb2YgcGFyc2luZ1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSAwO1xuICB9XG5cbiAgX3BhcnNlUEFUKGRhdGEsb2Zmc2V0KSB7XG4gICAgLy8gc2tpcCB0aGUgUFNJIGhlYWRlciBhbmQgcGFyc2UgdGhlIGZpcnN0IFBNVCBlbnRyeVxuICAgIHRoaXMuX3BtdElkICA9IChkYXRhW29mZnNldCsxMF0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQrMTFdO1xuICAgIC8vbG9nZ2VyLmxvZygnUE1UIFBJRDonICArIHRoaXMuX3BtdElkKTtcbiAgfVxuXG4gIF9wYXJzZVBNVChkYXRhLG9mZnNldCkge1xuICAgIHZhciBzZWN0aW9uTGVuZ3RoLHRhYmxlRW5kLHByb2dyYW1JbmZvTGVuZ3RoLHBpZDtcbiAgICBzZWN0aW9uTGVuZ3RoID0gKGRhdGFbb2Zmc2V0KzFdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0KzJdO1xuICAgIHRhYmxlRW5kID0gb2Zmc2V0ICsgMyArIHNlY3Rpb25MZW5ndGggLSA0O1xuICAgIC8vIHRvIGRldGVybWluZSB3aGVyZSB0aGUgdGFibGUgaXMsIHdlIGhhdmUgdG8gZmlndXJlIG91dCBob3dcbiAgICAvLyBsb25nIHRoZSBwcm9ncmFtIGluZm8gZGVzY3JpcHRvcnMgYXJlXG4gICAgcHJvZ3JhbUluZm9MZW5ndGggPSAoZGF0YVtvZmZzZXQrMTBdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0KzExXTtcblxuICAgIC8vIGFkdmFuY2UgdGhlIG9mZnNldCB0byB0aGUgZmlyc3QgZW50cnkgaW4gdGhlIG1hcHBpbmcgdGFibGVcbiAgICBvZmZzZXQgKz0gMTIgKyBwcm9ncmFtSW5mb0xlbmd0aDtcbiAgICB3aGlsZSAob2Zmc2V0IDwgdGFibGVFbmQpIHtcbiAgICAgIHBpZCA9IChkYXRhW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgICBzd2l0Y2goZGF0YVtvZmZzZXRdKSB7XG4gICAgICAgIC8vIElTTy9JRUMgMTM4MTgtNyBBRFRTIEFBQyAoTVBFRy0yIGxvd2VyIGJpdC1yYXRlIGF1ZGlvKVxuICAgICAgICBjYXNlIDB4MGY6XG4gICAgICAgIC8vbG9nZ2VyLmxvZygnQUFDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYWFjSWQgPSBwaWQ7XG4gICAgICAgICAgdGhpcy5fYWFjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBJVFUtVCBSZWMuIEguMjY0IGFuZCBJU08vSUVDIDE0NDk2LTEwIChsb3dlciBiaXQtcmF0ZSB2aWRlbylcbiAgICAgICAgY2FzZSAweDFiOlxuICAgICAgICAvL2xvZ2dlci5sb2coJ0FWQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICB0aGlzLl9hdmNJZCA9IHBpZDtcbiAgICAgICAgdGhpcy5fYXZjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICBsb2dnZXIubG9nKCd1bmtvd24gc3RyZWFtIHR5cGU6JyAgKyBkYXRhW29mZnNldF0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIG1vdmUgdG8gdGhlIG5leHQgdGFibGUgZW50cnlcbiAgICAgIC8vIHNraXAgcGFzdCB0aGUgZWxlbWVudGFyeSBzdHJlYW0gZGVzY3JpcHRvcnMsIGlmIHByZXNlbnRcbiAgICAgIG9mZnNldCArPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDBGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyA0XSkgKyA1O1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBFUyhzdHJlYW0pIHtcbiAgICB2YXIgaSA9IDAsZnJhZyxwZXNGbGFncyxwZXNQcmVmaXgscGVzTGVuLHBlc0hkckxlbixwZXNEYXRhLHBlc1B0cyxwZXNEdHMscGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgIC8vcmV0cmlldmUgUFRTL0RUUyBmcm9tIGZpcnN0IGZyYWdtZW50XG4gICAgZnJhZyA9IHN0cmVhbS5kYXRhWzBdO1xuICAgIHBlc1ByZWZpeCA9IChmcmFnWzBdIDw8IDE2KSArIChmcmFnWzFdIDw8IDgpICsgZnJhZ1syXTtcbiAgICBpZihwZXNQcmVmaXggPT09IDEpIHtcbiAgICAgIHBlc0xlbiA9IChmcmFnWzRdIDw8IDgpICsgZnJhZ1s1XTtcbiAgICAgIHBlc0ZsYWdzID0gZnJhZ1s3XTtcbiAgICAgIGlmIChwZXNGbGFncyAmIDB4QzApIHtcbiAgICAgICAgLyogUEVTIGhlYWRlciBkZXNjcmliZWQgaGVyZSA6IGh0dHA6Ly9kdmQuc291cmNlZm9yZ2UubmV0L2R2ZGluZm8vcGVzLWhkci5odG1sXG4gICAgICAgICAgICBhcyBQVFMgLyBEVFMgaXMgMzMgYml0IHdlIGNhbm5vdCB1c2UgYml0d2lzZSBvcGVyYXRvciBpbiBKUyxcbiAgICAgICAgICAgIGFzIEJpdHdpc2Ugb3BlcmF0b3JzIHRyZWF0IHRoZWlyIG9wZXJhbmRzIGFzIGEgc2VxdWVuY2Ugb2YgMzIgYml0cyAqL1xuICAgICAgICBwZXNQdHMgPSAoZnJhZ1s5XSAmIDB4MEUpKjUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgIChmcmFnWzEwXSAmIDB4RkYpKjQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAoZnJhZ1sxMV0gJiAweEZFKSoxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgIChmcmFnWzEyXSAmIDB4RkYpKjEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgKGZyYWdbMTNdICYgMHhGRSkvMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNQdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICAgIHBlc1B0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgaWYgKHBlc0ZsYWdzICYgMHg0MCkge1xuICAgICAgICAgIHBlc0R0cyA9IChmcmFnWzE0XSAmIDB4MEUgKSo1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAgIChmcmFnWzE1XSAmIDB4RkYgKSo0MTk0MzA0ICsvLyAxIDw8IDIyXG4gICAgICAgICAgICAoZnJhZ1sxNl0gJiAweEZFICkqMTYzODQgKy8vIDEgPDwgMTRcbiAgICAgICAgICAgIChmcmFnWzE3XSAmIDB4RkYgKSoxMjggKy8vIDEgPDwgN1xuICAgICAgICAgICAgKGZyYWdbMThdICYgMHhGRSApLzI7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgZ3JlYXRlciB0aGFuIDJeMzIgLTFcbiAgICAgICAgICBpZiAocGVzRHRzID4gNDI5NDk2NzI5NSkge1xuICAgICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgICBwZXNEdHMgLT0gODU4OTkzNDU5MjtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVzRHRzID0gcGVzUHRzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwZXNIZHJMZW4gPSBmcmFnWzhdO1xuICAgICAgcGF5bG9hZFN0YXJ0T2Zmc2V0ID0gcGVzSGRyTGVuKzk7XG4gICAgICAvLyB0cmltIFBFUyBoZWFkZXJcbiAgICAgIHN0cmVhbS5kYXRhWzBdID0gc3RyZWFtLmRhdGFbMF0uc3ViYXJyYXkocGF5bG9hZFN0YXJ0T2Zmc2V0KTtcbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgLy8gcmVhc3NlbWJsZSB0aGUgcGFja2V0XG4gICAgICB3aGlsZSAoc3RyZWFtLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBzdHJlYW0uZGF0YS5zaGlmdCgpO1xuICAgICAgICBwZXNEYXRhLnNldChmcmFnLCBpKTtcbiAgICAgICAgaSArPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4geyBkYXRhIDogcGVzRGF0YSwgcHRzIDogcGVzUHRzLCBkdHMgOiBwZXNEdHMsIGxlbiA6IHBlc0xlbn07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZUFWQ1BFUyhwZXMpIHtcbiAgICB2YXIgdW5pdHMsdHJhY2sgPSB0aGlzLl9hdmNUcmFjayxhdmNTYW1wbGUsa2V5ID0gZmFsc2U7XG4gICAgdW5pdHMgPSB0aGlzLl9wYXJzZUFWQ05BTHUocGVzLmRhdGEpO1xuICAgIC8vIG5vIE5BTHUgZm91bmRcbiAgICBpZih1bml0cy5sZW5ndGggPT09IDAgJiB0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFwcGVuZCBwZXMuZGF0YSB0byBwcmV2aW91cyBOQUwgdW5pdFxuICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzW3RoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoLTFdO1xuICAgICAgdmFyIGxhc3RVbml0ID0gbGFzdGF2Y1NhbXBsZS51bml0cy51bml0c1tsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLmxlbmd0aC0xXTtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgrcGVzLmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsMCk7XG4gICAgICB0bXAuc2V0KHBlcy5kYXRhLGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGgrPXBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoKz1wZXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICAvL2ZyZWUgcGVzLmRhdGEgdG8gc2F2ZSB1cCBzb21lIG1lbW9yeVxuICAgIHBlcy5kYXRhID0gbnVsbDtcbiAgICB1bml0cy51bml0cy5mb3JFYWNoKHVuaXQgPT4ge1xuICAgICAgc3dpdGNoKHVuaXQudHlwZSkge1xuICAgICAgICAvL0lEUlxuICAgICAgICBjYXNlIDU6XG4gICAgICAgICAga2V5ID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9TUFNcbiAgICAgICAgY2FzZSA3OlxuICAgICAgICAgIGlmKCF0cmFjay5zcHMpIHtcbiAgICAgICAgICAgIHZhciBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFNQUygpO1xuICAgICAgICAgICAgdHJhY2sud2lkdGggPSBjb25maWcud2lkdGg7XG4gICAgICAgICAgICB0cmFjay5oZWlnaHQgPSBjb25maWcuaGVpZ2h0O1xuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUlkYyA9IGNvbmZpZy5wcm9maWxlSWRjO1xuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUNvbXBhdCA9IGNvbmZpZy5wcm9maWxlQ29tcGF0O1xuICAgICAgICAgICAgdHJhY2subGV2ZWxJZGMgPSBjb25maWcubGV2ZWxJZGM7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMuTVA0X1RJTUVTQ0FMRTtcbiAgICAgICAgICAgIHRyYWNrLmR1cmF0aW9uID0gdGhpcy5NUDRfVElNRVNDQUxFKnRoaXMuX2R1cmF0aW9uO1xuICAgICAgICAgICAgdmFyIGNvZGVjYXJyYXkgPSB1bml0LmRhdGEuc3ViYXJyYXkoMSw0KTtcbiAgICAgICAgICAgIHZhciBjb2RlY3N0cmluZyAgPSAnYXZjMS4nO1xuICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBoID0gY29kZWNhcnJheVtpXS50b1N0cmluZygxNik7XG4gICAgICAgICAgICAgICAgaWYgKGgubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgICAgICBoID0gJzAnICsgaDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZWNzdHJpbmcgKz0gaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gY29kZWNzdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1BQU1xuICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgaWYoIXRyYWNrLnBwcykge1xuICAgICAgICAgICAgdHJhY2sucHBzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vYnVpbGQgc2FtcGxlIGZyb20gUEVTXG4gICAgLy8gQW5uZXggQiB0byBNUDQgY29udmVyc2lvbiB0byBiZSBkb25lXG4gICAgaWYodW5pdHMubGVuZ3RoKSB7XG4gICAgICBhdmNTYW1wbGUgPSB7IHVuaXRzIDogdW5pdHMsIHB0cyA6IHBlcy5wdHMsIGR0cyA6IHBlcy5kdHMgLCBrZXkgOiBrZXl9O1xuICAgICAgdGhpcy5fYXZjU2FtcGxlcy5wdXNoKGF2Y1NhbXBsZSk7XG4gICAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoICs9IHVuaXRzLmxlbmd0aDtcbiAgICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgKz0gdW5pdHMudW5pdHMubGVuZ3RoO1xuICAgIH1cbiAgfVxuXG5cbiAgX2ZsdXNoQVZDU2FtcGxlcygpIHtcbiAgICB2YXIgdmlldyxpPTgsYXZjU2FtcGxlLG1wNFNhbXBsZSxtcDRTYW1wbGVMZW5ndGgsdW5pdCx0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICBsYXN0U2FtcGxlRFRTLG1kYXQsbW9vZixmaXJzdFBUUyxmaXJzdERUUyxwdHMsZHRzLHB0c25vcm0sZHRzbm9ybSxzYW1wbGVzID0gW107XG5cbiAgICAvKiBjb25jYXRlbmF0ZSB0aGUgdmlkZW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1wZGF0IHR5cGUpICovXG4gICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggKyAoNCAqIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUpKzgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsbWRhdC5ieXRlTGVuZ3RoKTtcbiAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCw0KTtcbiAgICB3aGlsZSh0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgYXZjU2FtcGxlID0gdGhpcy5fYXZjU2FtcGxlcy5zaGlmdCgpO1xuICAgICAgbXA0U2FtcGxlTGVuZ3RoID0gMDtcblxuICAgICAgLy8gY29udmVydCBOQUxVIGJpdHN0cmVhbSB0byBNUDQgZm9ybWF0IChwcmVwZW5kIE5BTFUgd2l0aCBzaXplIGZpZWxkKVxuICAgICAgd2hpbGUoYXZjU2FtcGxlLnVuaXRzLnVuaXRzLmxlbmd0aCkge1xuICAgICAgICB1bml0ID0gYXZjU2FtcGxlLnVuaXRzLnVuaXRzLnNoaWZ0KCk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKGksIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgaSArPSA0O1xuICAgICAgICBtZGF0LnNldCh1bml0LmRhdGEsIGkpO1xuICAgICAgICBpICs9IHVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgICBtcDRTYW1wbGVMZW5ndGgrPTQrdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICBwdHMgPSBhdmNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGF2Y1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKCdWaWRlby9QVFMvRFRTOicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyk7XG5cbiAgICAgIGlmKGxhc3RTYW1wbGVEVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cyxsYXN0U2FtcGxlRFRTKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsbGFzdFNhbXBsZURUUyk7XG5cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gKGR0c25vcm0gLSBsYXN0U2FtcGxlRFRTKS90aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgICAgICAgaWYobXA0U2FtcGxlLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnaW52YWxpZCBzYW1wbGUgZHVyYXRpb24gYXQgUFRTL0RUUzo6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzICsgJzonICsgbXA0U2FtcGxlLmR1cmF0aW9uKTtcbiAgICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cyx0aGlzLm5leHRBdmNQdHMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cyx0aGlzLm5leHRBdmNQdHMpO1xuICAgICAgICAvLyBjaGVjayBpZiBmcmFnbWVudHMgYXJlIGNvbnRpZ3VvdXMgKGkuZS4gbm8gbWlzc2luZyBmcmFtZXMgYmV0d2VlbiBmcmFnbWVudClcbiAgICAgICAgaWYodGhpcy5uZXh0QXZjUHRzKSB7XG4gICAgICAgICAgdmFyIGRlbHRhID0gTWF0aC5yb3VuZCgocHRzbm9ybSAtIHRoaXMubmV4dEF2Y1B0cykvOTApLGFic2RlbHRhPU1hdGguYWJzKGRlbHRhKTtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fic2RlbHRhL2F2Y1NhbXBsZS5wdHM6JyArIGFic2RlbHRhICsgJy8nICsgYXZjU2FtcGxlLnB0cyk7XG4gICAgICAgICAgLy8gaWYgZGVsdGEgaXMgbGVzcyB0aGFuIDMwMCBtcywgbmV4dCBsb2FkZWQgZnJhZ21lbnQgaXMgYXNzdW1lZCB0byBiZSBjb250aWd1b3VzIHdpdGggbGFzdCBvbmVcbiAgICAgICAgICBpZihhYnNkZWx0YSA8IDMwMCkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdWaWRlbyBuZXh0IFBUUzonICsgdGhpcy5uZXh0QXZjUHRzKTtcbiAgICAgICAgICAgIGlmKGRlbHRhID4gMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlbHRhIDwgLTEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7KC1kZWx0YSl9IG1zIG92ZXJsYXBwaW5nIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBzZXQgUFRTIHRvIG5leHQgUFRTXG4gICAgICAgICAgICBwdHNub3JtID0gdGhpcy5uZXh0QXZjUHRzO1xuICAgICAgICAgICAgLy8gb2Zmc2V0IERUUyBhcyB3ZWxsLCBlbnN1cmUgdGhhdCBEVFMgaXMgc21hbGxlciBvciBlcXVhbCB0aGFuIG5ldyBQVFNcbiAgICAgICAgICAgIGR0c25vcm0gPSBNYXRoLm1heChkdHNub3JtLWRlbHRhLCB0aGlzLmxhc3RBdmNEdHMpO1xuICAgICAgICAgICAvLyBsb2dnZXIubG9nKCdWaWRlby9QVFMvRFRTIGFkanVzdGVkOicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gbm90IGNvbnRpZ3VvdXMgdGltZXN0YW1wLCBjaGVjayBpZiBQVFMgaXMgd2l0aGluIGFjY2VwdGFibGUgcmFuZ2VcbiAgICAgICAgICAgIHZhciBleHBlY3RlZFBUUyA9IHRoaXMuUEVTX1RJTUVTQ0FMRSp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB0aGVyZSBpcyBhbnkgdW5leHBlY3RlZCBkcmlmdCBiZXR3ZWVuIGV4cGVjdGVkIHRpbWVzdGFtcCBhbmQgcmVhbCBvbmVcbiAgICAgICAgICAgIGlmKE1hdGguYWJzKGV4cGVjdGVkUFRTIC0gcHRzbm9ybSkgPiB0aGlzLlBFU19USU1FU0NBTEUqMzYwMCApIHtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBQVFMgbG9vcGluZyA/Pz8gQVZDIFBUUyBkZWx0YToke2V4cGVjdGVkUFRTLXB0c25vcm19YCk7XG4gICAgICAgICAgICAgIHZhciBwdHNPZmZzZXQgPSBleHBlY3RlZFBUUy1wdHNub3JtO1xuICAgICAgICAgICAgICAvLyBzZXQgUFRTIHRvIG5leHQgZXhwZWN0ZWQgUFRTO1xuICAgICAgICAgICAgICBwdHNub3JtID0gZXhwZWN0ZWRQVFM7XG4gICAgICAgICAgICAgIGR0c25vcm0gPSBwdHNub3JtO1xuICAgICAgICAgICAgICAvLyBvZmZzZXQgaW5pdFBUUy9pbml0RFRTIHRvIGZpeCBjb21wdXRhdGlvbiBmb3IgZm9sbG93aW5nIHNhbXBsZXNcbiAgICAgICAgICAgICAgdGhpcy5faW5pdFBUUy09cHRzT2Zmc2V0O1xuICAgICAgICAgICAgICB0aGlzLl9pbml0RFRTLT1wdHNPZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiBvdXIgYXZjU2FtcGxlcywgZW5zdXJlIHZhbHVlIGlzIHBvc2l0aXZlXG4gICAgICAgIGZpcnN0UFRTID0gTWF0aC5tYXgoMCxwdHNub3JtKTtcbiAgICAgICAgZmlyc3REVFMgPSBNYXRoLm1heCgwLGR0c25vcm0pO1xuICAgICAgfVxuICAgICAgLy9jb25zb2xlLmxvZyhgUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2F2Y1NhbXBsZS5wdHN9LyR7YXZjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYXZjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfWApO1xuXG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgZHVyYXRpb24gOiAwLFxuICAgICAgICBjdHM6IChwdHNub3JtIC0gZHRzbm9ybSkvdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDBcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgaWYoYXZjU2FtcGxlLmtleSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyB0aGUgY3VycmVudCBzYW1wbGUgaXMgYSBrZXkgZnJhbWVcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5pc05vblN5bmMgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA9IDE7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5pc05vblN5bmMgPSAxO1xuICAgICAgfVxuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0U2FtcGxlRFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgaWYoc2FtcGxlcy5sZW5ndGggPj0yKSB7XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoLTJdLmR1cmF0aW9uO1xuICAgIH1cbiAgICB0aGlzLmxhc3RBdmNEdHMgPSBkdHNub3JtO1xuICAgIC8vIG5leHQgQVZDIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QXZjUHRzID0gcHRzbm9ybSArIG1wNFNhbXBsZS5kdXJhdGlvbip0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgICAvL2xvZ2dlci5sb2coJ1ZpZGVvL2xhc3RBdmNEdHMvbmV4dEF2Y1B0czonICsgdGhpcy5sYXN0QXZjRHRzICsgJy8nICsgdGhpcy5uZXh0QXZjUHRzKTtcblxuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgPSAwO1xuXG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssZmlyc3REVFMvdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsdHJhY2spO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFMgOiBmaXJzdFBUUy90aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICBlbmRQVFMgOiB0aGlzLm5leHRBdmNQdHMvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgc3RhcnREVFMgOiBmaXJzdERUUy90aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICBlbmREVFMgOiAoZHRzbm9ybSArIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SKm1wNFNhbXBsZS5kdXJhdGlvbikvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgdHlwZSA6ICd2aWRlbycsXG4gICAgICBuYiA6IHNhbXBsZXMubGVuZ3RoXG4gICAgfSk7XG4gIH1cblxuICBfcGFyc2VBVkNOQUx1KGFycmF5KSB7XG4gICAgdmFyIGkgPSAwLGxlbiA9IGFycmF5LmJ5dGVMZW5ndGgsdmFsdWUsb3ZlcmZsb3csc3RhdGUgPSAwO1xuICAgIHZhciB1bml0cyA9IFtdLCB1bml0LCB1bml0VHlwZSwgbGFzdFVuaXRTdGFydCxsYXN0VW5pdFR5cGUsbGVuZ3RoID0gMDtcbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoYXJyYXkpKTtcblxuICAgIHdoaWxlKGk8IGxlbikge1xuICAgICAgdmFsdWUgPSBhcnJheVtpKytdO1xuICAgICAgLy8gZmluZGluZyAzIG9yIDQtYnl0ZSBzdGFydCBjb2RlcyAoMDAgMDAgMDEgT1IgMDAgMDAgMDAgMDEpXG4gICAgICBzd2l0Y2goc3RhdGUpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgIGlmKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYodmFsdWUgPT09IDEpIHtcbiAgICAgICAgICAgIHVuaXRUeXBlID0gYXJyYXlbaV0gJiAweDFmO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIE5BTFUgQCBvZmZzZXQ6JyArIGkgKyAnLHR5cGU6JyArIHVuaXRUeXBlKTtcbiAgICAgICAgICAgIGlmKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgICAgICAgICAgdW5pdCA9IHsgZGF0YSA6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsaS1zdGF0ZS0xKSwgdHlwZSA6IGxhc3RVbml0VHlwZX07XG4gICAgICAgICAgICAgIGxlbmd0aCs9aS1zdGF0ZS0xLWxhc3RVbml0U3RhcnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIE5BTCB1bml0cyBhcmUgbm90IHN0YXJ0aW5nIHJpZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYWNrZXQsIHB1c2ggcHJlY2VkaW5nIGRhdGEgaW50byBwcmV2aW91cyBOQUwgdW5pdC5cbiAgICAgICAgICAgICAgb3ZlcmZsb3cgID0gaSAtIHN0YXRlIC0gMTtcbiAgICAgICAgICAgICAgaWYgKG92ZXJmbG93KSB7XG4gICAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpcnN0IE5BTFUgZm91bmQgd2l0aCBvdmVyZmxvdzonICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgaWYodGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzW3RoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoLTFdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoLTFdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoK292ZXJmbG93KTtcbiAgICAgICAgICAgICAgICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLDApO1xuICAgICAgICAgICAgICAgICAgICB0bXAuc2V0KGFycmF5LnN1YmFycmF5KDAsb3ZlcmZsb3cpLGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RVbml0LmRhdGEgPSB0bXA7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoKz1vdmVyZmxvdztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCs9b3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxhc3RVbml0U3RhcnQgPSBpO1xuICAgICAgICAgICAgbGFzdFVuaXRUeXBlID0gdW5pdFR5cGU7XG4gICAgICAgICAgICBpZih1bml0VHlwZSA9PT0gMSB8fCB1bml0VHlwZSA9PT0gNSkge1xuICAgICAgICAgICAgICAvLyBPUFRJICEhISBpZiBJRFIvTkRSIHVuaXQsIGNvbnNpZGVyIGl0IGlzIGxhc3QgTkFMdVxuICAgICAgICAgICAgICBpID0gbGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICB1bml0ID0geyBkYXRhIDogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCxsZW4pLCB0eXBlIDogbGFzdFVuaXRUeXBlfTtcbiAgICAgIGxlbmd0aCs9bGVuLWxhc3RVbml0U3RhcnQ7XG4gICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4geyB1bml0cyA6IHVuaXRzICwgbGVuZ3RoIDogbGVuZ3RofTtcbiAgfVxuXG4gIF9QVFNOb3JtYWxpemUodmFsdWUscmVmZXJlbmNlKSB7XG4gICAgdmFyIG9mZnNldDtcbiAgICBpZiAocmVmZXJlbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgaWYgKHJlZmVyZW5jZSA8IHZhbHVlKSB7XG4gICAgICAgIC8vIC0gMl4zM1xuICAgICAgICBvZmZzZXQgPSAtODU4OTkzNDU5MjtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyArIDJeMzNcbiAgICAgICAgb2Zmc2V0ID0gODU4OTkzNDU5MjtcbiAgICB9XG4gICAgLyogUFRTIGlzIDMzYml0IChmcm9tIDAgdG8gMl4zMyAtMSlcbiAgICAgIGlmIGRpZmYgYmV0d2VlbiB2YWx1ZSBhbmQgcmVmZXJlbmNlIGlzIGJpZ2dlciB0aGFuIGhhbGYgb2YgdGhlIGFtcGxpdHVkZSAoMl4zMikgdGhlbiBpdCBtZWFucyB0aGF0XG4gICAgICBQVFMgbG9vcGluZyBvY2N1cmVkLiBmaWxsIHRoZSBnYXAgKi9cbiAgICB3aGlsZSAoTWF0aC5hYnModmFsdWUgLSByZWZlcmVuY2UpID4gNDI5NDk2NzI5Nikge1xuICAgICAgICB2YWx1ZSArPSBvZmZzZXQ7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIF9wYXJzZUFBQ1BFUyhwZXMpIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxhYWNTYW1wbGUsZGF0YSA9IHBlcy5kYXRhLGNvbmZpZyxhZHRzRnJhbWVTaXplLGFkdHNTdGFydE9mZnNldCxhZHRzSGVhZGVyTGVuLHN0YW1wLG5iU2FtcGxlcyxsZW47XG4gICAgaWYodGhpcy5hYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KHRoaXMuYWFjT3ZlckZsb3cuYnl0ZUxlbmd0aCtkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldCh0aGlzLmFhY092ZXJGbG93LDApO1xuICAgICAgdG1wLnNldChkYXRhLHRoaXMuYWFjT3ZlckZsb3cuYnl0ZUxlbmd0aCk7XG4gICAgICBkYXRhID0gdG1wO1xuICAgIH1cbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvcihhZHRzU3RhcnRPZmZzZXQgPSAwLCBsZW4gPSBkYXRhLmxlbmd0aDsgYWR0c1N0YXJ0T2Zmc2V0PGxlbi0xOyBhZHRzU3RhcnRPZmZzZXQrKykge1xuICAgICAgaWYoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0XSA9PT0gMHhmZikgJiYgKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzFdICYgMHhmMCkgPT09IDB4ZjApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIEFEVFMgaGVhZGVyIGRvZXMgbm90IHN0YXJ0IHN0cmFpZ2h0IGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgUEVTIHBheWxvYWQsIHJhaXNlIGFuIGVycm9yXG4gICAgaWYoYWR0c1N0YXJ0T2Zmc2V0KSB7XG4gICAgICB2YXIgcmVhc29uLGZhdGFsO1xuICAgICAgaWYoYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuIC0gMSkge1xuICAgICAgICByZWFzb24gPSBgQUFDIFBFUyBkaWQgbm90IHN0YXJ0IHdpdGggQURUUyBoZWFkZXIsb2Zmc2V0OiR7YWR0c1N0YXJ0T2Zmc2V0fWA7XG4gICAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWFzb24gPSBgbm8gQURUUyBoZWFkZXIgZm91bmQgaW4gQUFDIFBFU2A7XG4gICAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHsgdHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDpmYXRhbCwgcmVhc29uIDogcmVhc29ufSk7XG4gICAgICBpZihmYXRhbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gdGhpcy5fQURUU3RvQXVkaW9Db25maWcoZGF0YSxhZHRzU3RhcnRPZmZzZXQsdGhpcy5hdWRpb0NvZGVjKTtcbiAgICAgIHRyYWNrLmNvbmZpZyA9IGNvbmZpZy5jb25maWc7XG4gICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICB0cmFjay5jb2RlYyA9IGNvbmZpZy5jb2RlYztcbiAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMuTVA0X1RJTUVTQ0FMRTtcbiAgICAgIHRyYWNrLmR1cmF0aW9uID0gdGhpcy5NUDRfVElNRVNDQUxFKnRoaXMuX2R1cmF0aW9uO1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkICAgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICB9XG4gICAgbmJTYW1wbGVzID0gMDtcbiAgICB3aGlsZSgoYWR0c1N0YXJ0T2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGFkdHNGcmFtZVNpemUgPSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzNdICYgMHgwMykgPDwgMTEpO1xuICAgICAgLy8gYnl0ZSA0XG4gICAgICBhZHRzRnJhbWVTaXplIHw9IChkYXRhW2FkdHNTdGFydE9mZnNldCs0XSA8PCAzKTtcbiAgICAgIC8vIGJ5dGUgNVxuICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgYWR0c0hlYWRlckxlbiA9ICghIShkYXRhW2FkdHNTdGFydE9mZnNldCsxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgYWR0c0ZyYW1lU2l6ZSAtPSBhZHRzSGVhZGVyTGVuO1xuICAgICAgc3RhbXAgPSBNYXRoLnJvdW5kKHBlcy5wdHMgKyBuYlNhbXBsZXMqMTAyNCp0aGlzLlBFU19USU1FU0NBTEUvdHJhY2suYXVkaW9zYW1wbGVyYXRlKTtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuICAgICAgLy9jb25zb2xlLmxvZygnQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3B0czonICsgKGFkdHNTdGFydE9mZnNldCs3KSArICcvJyArIGFkdHNGcmFtZVNpemUgKyAnLycgKyBzdGFtcC50b0ZpeGVkKDApKTtcbiAgICAgIGlmKGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuK2FkdHNGcmFtZVNpemUgPD0gbGVuKSB7XG4gICAgICAgIGFhY1NhbXBsZSA9IHsgdW5pdCA6IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0K2FkdHNIZWFkZXJMZW4sYWR0c1N0YXJ0T2Zmc2V0K2FkdHNIZWFkZXJMZW4rYWR0c0ZyYW1lU2l6ZSkgLCBwdHMgOiBzdGFtcCwgZHRzIDogc3RhbXB9O1xuICAgICAgICB0aGlzLl9hYWNTYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgdGhpcy5fYWFjU2FtcGxlc0xlbmd0aCArPSBhZHRzRnJhbWVTaXplO1xuICAgICAgICBhZHRzU3RhcnRPZmZzZXQrPWFkdHNGcmFtZVNpemUrYWR0c0hlYWRlckxlbjtcbiAgICAgICAgbmJTYW1wbGVzKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuKSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShhZHRzU3RhcnRPZmZzZXQsbGVuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgX2ZsdXNoQUFDU2FtcGxlcygpIHtcbiAgICB2YXIgdmlldyxpPTgsYWFjU2FtcGxlLG1wNFNhbXBsZSx1bml0LHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGxhc3RTYW1wbGVEVFMsbWRhdCxtb29mLGZpcnN0UFRTLGZpcnN0RFRTLHB0cyxkdHMscHRzbm9ybSxkdHNub3JtLHNhbXBsZXMgPSBbXTtcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYWFjU2FtcGxlc0xlbmd0aCs4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsNCk7XG4gICAgd2hpbGUodGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHRoaXMuX2FhY1NhbXBsZXMuc2hpZnQoKTtcbiAgICAgIHVuaXQgPSBhYWNTYW1wbGUudW5pdDtcbiAgICAgIG1kYXQuc2V0KHVuaXQsIGkpO1xuICAgICAgaSArPSB1bml0LmJ5dGVMZW5ndGg7XG5cbiAgICAgIHB0cyA9IGFhY1NhbXBsZS5wdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgZHRzID0gYWFjU2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFM7XG5cbiAgICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8vUFRTOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkpO1xuICAgICAgaWYobGFzdFNhbXBsZURUUyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLGxhc3RTYW1wbGVEVFMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cyxsYXN0U2FtcGxlRFRTKTtcbiAgICAgICAgLy8gd2UgdXNlIERUUyB0byBjb21wdXRlIHNhbXBsZSBkdXJhdGlvbiwgYnV0IHdlIHVzZSBQVFMgdG8gY29tcHV0ZSBpbml0UFRTIHdoaWNoIGlzIHVzZWQgdG8gc3luYyBhdWRpbyBhbmQgdmlkZW9cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gKGR0c25vcm0gLSBsYXN0U2FtcGxlRFRTKS90aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgICAgICAgaWYobXA0U2FtcGxlLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnaW52YWxpZCBzYW1wbGUgZHVyYXRpb24gYXQgUFRTL0RUUzo6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzICsgJzonICsgbXA0U2FtcGxlLmR1cmF0aW9uKTtcbiAgICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cyx0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cyx0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICAvLyBjaGVjayBpZiBmcmFnbWVudHMgYXJlIGNvbnRpZ3VvdXMgKGkuZS4gbm8gbWlzc2luZyBmcmFtZXMgYmV0d2VlbiBmcmFnbWVudClcbiAgICAgICAgaWYodGhpcy5uZXh0QWFjUHRzICYmIHRoaXMubmV4dEFhY1B0cyAhPT0gcHRzbm9ybSkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8gbmV4dCBQVFM6JyArIHRoaXMubmV4dEFhY1B0cyk7XG4gICAgICAgICAgdmFyIGRlbHRhID0gTWF0aC5yb3VuZCgxMDAwKihwdHNub3JtIC0gdGhpcy5uZXh0QWFjUHRzKS90aGlzLlBFU19USU1FU0NBTEUpLGFic2RlbHRhPU1hdGguYWJzKGRlbHRhKTtcbiAgICAgICAgICAvLyBpZiBkZWx0YSBpcyBsZXNzIHRoYW4gMzAwIG1zLCBuZXh0IGxvYWRlZCBmcmFnbWVudCBpcyBhc3N1bWVkIHRvIGJlIGNvbnRpZ3VvdXMgd2l0aCBsYXN0IG9uZVxuICAgICAgICAgIGlmKGFic2RlbHRhID4gMSAmJiBhYnNkZWx0YSA8IDMwMCkge1xuICAgICAgICAgICAgaWYoZGVsdGEgPiAwKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFBQzoke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkLGZpbGxpbmcgaXRgKTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IFBUUywgYW5kIGVuc3VyZSBQVFMgaXMgZ3JlYXRlciBvciBlcXVhbCB0aGFuIGxhc3QgRFRTXG4gICAgICAgICAgICAgIHB0c25vcm0gPSBNYXRoLm1heCh0aGlzLm5leHRBYWNQdHMsIHRoaXMubGFzdEFhY0R0cyk7XG4gICAgICAgICAgICAgIGR0c25vcm0gPSBwdHNub3JtO1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9EVFMgYWRqdXN0ZWQ6JyArIGFhY1NhbXBsZS5wdHMgKyAnLycgKyBhYWNTYW1wbGUuZHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFBQzokeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmIChhYnNkZWx0YSkge1xuICAgICAgICAgICAgLy8gbm90IGNvbnRpZ3VvdXMgdGltZXN0YW1wLCBjaGVjayBpZiBQVFMgaXMgd2l0aGluIGFjY2VwdGFibGUgcmFuZ2VcbiAgICAgICAgICAgIHZhciBleHBlY3RlZFBUUyA9IHRoaXMuUEVTX1RJTUVTQ0FMRSp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coYGV4cGVjdGVkUFRTL1BUU25vcm06JHtleHBlY3RlZFBUU30vJHtwdHNub3JtfS8ke2V4cGVjdGVkUFRTLXB0c25vcm19YCk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB0aGVyZSBpcyBhbnkgdW5leHBlY3RlZCBkcmlmdCBiZXR3ZWVuIGV4cGVjdGVkIHRpbWVzdGFtcCBhbmQgcmVhbCBvbmVcbiAgICAgICAgICAgIGlmKE1hdGguYWJzKGV4cGVjdGVkUFRTIC0gcHRzbm9ybSkgPiB0aGlzLlBFU19USU1FU0NBTEUqMzYwMCApIHtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBQVFMgbG9vcGluZyA/Pz8gQUFDIFBUUyBkZWx0YToke2V4cGVjdGVkUFRTLXB0c25vcm19YCk7XG4gICAgICAgICAgICAgIHZhciBwdHNPZmZzZXQgPSBleHBlY3RlZFBUUy1wdHNub3JtO1xuICAgICAgICAgICAgICAvLyBzZXQgUFRTIHRvIG5leHQgZXhwZWN0ZWQgUFRTO1xuICAgICAgICAgICAgICBwdHNub3JtID0gZXhwZWN0ZWRQVFM7XG4gICAgICAgICAgICAgIGR0c25vcm0gPSBwdHNub3JtO1xuICAgICAgICAgICAgICAvLyBvZmZzZXQgaW5pdFBUUy9pbml0RFRTIHRvIGZpeCBjb21wdXRhdGlvbiBmb3IgZm9sbG93aW5nIHNhbXBsZXNcbiAgICAgICAgICAgICAgdGhpcy5faW5pdFBUUy09cHRzT2Zmc2V0O1xuICAgICAgICAgICAgICB0aGlzLl9pbml0RFRTLT1wdHNPZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiBvdXIgYWFjU2FtcGxlcywgZW5zdXJlIHZhbHVlIGlzIHBvc2l0aXZlXG4gICAgICAgIGZpcnN0UFRTID0gTWF0aC5tYXgoMCxwdHNub3JtKTtcbiAgICAgICAgZmlyc3REVFMgPSBNYXRoLm1heCgwLGR0c25vcm0pO1xuICAgICAgfVxuICAgICAgLy9jb25zb2xlLmxvZyhgUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2FhY1NhbXBsZS5wdHN9LyR7YWFjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYWFjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfWApO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiB1bml0LmJ5dGVMZW5ndGgsXG4gICAgICAgIGN0czogMCxcbiAgICAgICAgZHVyYXRpb246MCxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMCxcbiAgICAgICAgICBkZXBlbmRzT24gOiAxLFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0U2FtcGxlRFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIGlmKHNhbXBsZXMubGVuZ3RoID49Mikge1xuICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gc2FtcGxlc1tzYW1wbGVzLmxlbmd0aC0yXS5kdXJhdGlvbjtcbiAgICB9XG4gICAgdGhpcy5sYXN0QWFjRHRzID0gZHRzbm9ybTtcbiAgICAvLyBuZXh0IGFhYyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgIHRoaXMubmV4dEFhY1B0cyA9IHB0c25vcm0gKyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUiptcDRTYW1wbGUuZHVyYXRpb247XG4gICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvUFRTZW5kOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkgKyAnLycgKyB0aGlzLm5leHRBYWNEdHMudG9GaXhlZCgwKSk7XG5cbiAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKyxmaXJzdERUUy90aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUix0cmFjayk7XG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUyA6IGZpcnN0UFRTL3RoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIGVuZFBUUyA6IHRoaXMubmV4dEFhY1B0cy90aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICBzdGFydERUUyA6IGZpcnN0RFRTL3RoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIGVuZERUUyA6IChkdHNub3JtICsgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IqbXA0U2FtcGxlLmR1cmF0aW9uKS90aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICB0eXBlIDogJ2F1ZGlvJyxcbiAgICAgIG5iIDogc2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIF9BRFRTdG9BdWRpb0NvbmZpZyhkYXRhLG9mZnNldCxhdWRpb0NvZGVjKSB7XG4gICAgdmFyIGFkdHNPYmplY3RUeXBlLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBjb25maWcsXG4gICAgICAgIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgICAgICAgICAgOTYwMDAsIDg4MjAwLFxuICAgICAgICAgICAgNjQwMDAsIDQ4MDAwLFxuICAgICAgICAgICAgNDQxMDAsIDMyMDAwLFxuICAgICAgICAgICAgMjQwMDAsIDIyMDUwLFxuICAgICAgICAgICAgMTYwMDAsIDEyMDAwXG4gICAgICAgICAgXTtcblxuICAgIC8vIGJ5dGUgMlxuICAgIGFkdHNPYmplY3RUeXBlID0gKChkYXRhW29mZnNldCsyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgYWR0c1NhbXBsZWluZ0luZGV4ID0gKChkYXRhW29mZnNldCsyXSAmIDB4M0MpID4+PiAyKTtcbiAgICBhZHRzQ2hhbmVsQ29uZmlnID0gKChkYXRhW29mZnNldCsyXSAmIDB4MDEpIDw8IDIpO1xuICAgIC8vIGJ5dGUgM1xuICAgIGFkdHNDaGFuZWxDb25maWcgfD0gKChkYXRhW29mZnNldCszXSAmIDB4QzApID4+PiA2KTtcblxuICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGNvZGVjOiR7YXVkaW9Db2RlY30sQURUUyBkYXRhOnR5cGU6JHthZHRzT2JqZWN0VHlwZX0sc2FtcGxlaW5nSW5kZXg6JHthZHRzU2FtcGxlaW5nSW5kZXh9WyR7YWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF19a0h6XSxjaGFubmVsQ29uZmlnOiR7YWR0c0NoYW5lbENvbmZpZ31gKTtcblxuXG4gICAgLy8gZmlyZWZveDogZnJlcSBsZXNzIHRoYW4gMjRrSHogPSBBQUMgU0JSIChIRS1BQUMpXG4gICAgaWYodXNlckFnZW50LmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEpIHtcbiAgICAgIGlmKGFkdHNTYW1wbGVpbmdJbmRleCA+PTYpIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXgtMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgICAvLyBBbmRyb2lkIDogYWx3YXlzIHVzZSBBQUNcbiAgICB9IGVsc2UgaWYodXNlckFnZW50LmluZGV4T2YoJ2FuZHJvaWQnKSAhPT0gLTEpIHtcbiAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgLyogIGZvciBvdGhlciBicm93c2VycyAoY2hyb21lIC4uLilcbiAgICAgICAgICBhbHdheXMgZm9yY2UgYXVkaW8gdHlwZSB0byBiZSBIRS1BQUMgU0JSLCBhcyBzb21lIGJyb3dzZXJzIGRvIG5vdCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaCBwcm9wZXJseSAobGlrZSBDaHJvbWUgLi4uKVxuICAgICAgKi9cbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEhFLUFBQykgT1IgKG1hbmlmZXN0IGNvZGVjIG5vdCBzcGVjaWZpZWQgQU5EIGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHopXG4gICAgICBpZigoYXVkaW9Db2RlYyAmJiBhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB8fCAoIWF1ZGlvQ29kZWMgJiYgYWR0c1NhbXBsZWluZ0luZGV4ID49NikpICB7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBBQUMpIEFORCAoZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeiBPUiBuYiBjaGFubmVsIGlzIDEpXG4gICAgICAgIGlmKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0tMSAmJiAoYWR0c1NhbXBsZWluZ0luZGV4ID49IDYgfHwgYWR0c0NoYW5lbENvbmZpZyA9PT0xKSkge1xuICAgICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIH1cbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgIH1cbiAgLyogcmVmZXIgdG8gaHR0cDovL3dpa2kubXVsdGltZWRpYS5jeC9pbmRleC5waHA/dGl0bGU9TVBFRy00X0F1ZGlvI0F1ZGlvX1NwZWNpZmljX0NvbmZpZ1xuICAgICAgSVNPIDE0NDk2LTMgKEFBQykucGRmIC0gVGFibGUgMS4xMyDigJQgU3ludGF4IG9mIEF1ZGlvU3BlY2lmaWNDb25maWcoKVxuICAgIEF1ZGlvIFByb2ZpbGUgLyBBdWRpbyBPYmplY3QgVHlwZVxuICAgIDA6IE51bGxcbiAgICAxOiBBQUMgTWFpblxuICAgIDI6IEFBQyBMQyAoTG93IENvbXBsZXhpdHkpXG4gICAgMzogQUFDIFNTUiAoU2NhbGFibGUgU2FtcGxlIFJhdGUpXG4gICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgNTogU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKVxuICAgIDY6IEFBQyBTY2FsYWJsZVxuICAgc2FtcGxpbmcgZnJlcVxuICAgIDA6IDk2MDAwIEh6XG4gICAgMTogODgyMDAgSHpcbiAgICAyOiA2NDAwMCBIelxuICAgIDM6IDQ4MDAwIEh6XG4gICAgNDogNDQxMDAgSHpcbiAgICA1OiAzMjAwMCBIelxuICAgIDY6IDI0MDAwIEh6XG4gICAgNzogMjIwNTAgSHpcbiAgICA4OiAxNjAwMCBIelxuICAgIDk6IDEyMDAwIEh6XG4gICAgMTA6IDExMDI1IEh6XG4gICAgMTE6IDgwMDAgSHpcbiAgICAxMjogNzM1MCBIelxuICAgIDEzOiBSZXNlcnZlZFxuICAgIDE0OiBSZXNlcnZlZFxuICAgIDE1OiBmcmVxdWVuY3kgaXMgd3JpdHRlbiBleHBsaWN0bHlcbiAgICBDaGFubmVsIENvbmZpZ3VyYXRpb25zXG4gICAgVGhlc2UgYXJlIHRoZSBjaGFubmVsIGNvbmZpZ3VyYXRpb25zOlxuICAgIDA6IERlZmluZWQgaW4gQU9UIFNwZWNpZmMgQ29uZmlnXG4gICAgMTogMSBjaGFubmVsOiBmcm9udC1jZW50ZXJcbiAgICAyOiAyIGNoYW5uZWxzOiBmcm9udC1sZWZ0LCBmcm9udC1yaWdodFxuICAqL1xuICAgIC8vIGF1ZGlvT2JqZWN0VHlwZSA9IHByb2ZpbGUgPT4gcHJvZmlsZSwgdGhlIE1QRUctNCBBdWRpbyBPYmplY3QgVHlwZSBtaW51cyAxXG4gICAgY29uZmlnWzBdID0gYWR0c09iamVjdFR5cGUgPDwgMztcbiAgICAvLyBzYW1wbGluZ0ZyZXF1ZW5jeUluZGV4XG4gICAgY29uZmlnWzBdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgIGNvbmZpZ1sxXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAvLyBjaGFubmVsQ29uZmlndXJhdGlvblxuICAgIGNvbmZpZ1sxXSB8PSBhZHRzQ2hhbmVsQ29uZmlnIDw8IDM7XG4gICAgaWYoYWR0c09iamVjdFR5cGUgPT09IDUpIHtcbiAgICAgIC8vIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleFxuICAgICAgY29uZmlnWzFdIHw9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgICAgY29uZmlnWzJdID0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgICAvLyBhZHRzT2JqZWN0VHlwZSAoZm9yY2UgdG8gMiwgY2hyb21lIGlzIGNoZWNraW5nIHRoYXQgb2JqZWN0IHR5cGUgaXMgbGVzcyB0aGFuIDUgPz8/XG4gICAgICAvLyAgICBodHRwczovL2Nocm9taXVtLmdvb2dsZXNvdXJjZS5jb20vY2hyb21pdW0vc3JjLmdpdC8rL21hc3Rlci9tZWRpYS9mb3JtYXRzL21wNC9hYWMuY2NcbiAgICAgIGNvbmZpZ1syXSB8PSAyIDw8IDI7XG4gICAgICBjb25maWdbM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4geyBjb25maWcgOiBjb25maWcsIHNhbXBsZXJhdGUgOiBhZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XSwgY2hhbm5lbENvdW50IDogYWR0c0NoYW5lbENvbmZpZywgY29kZWMgOiAoJ21wNGEuNDAuJyArIGFkdHNPYmplY3RUeXBlKX07XG4gIH1cblxuICBfZ2VuZXJhdGVJbml0U2VnbWVudCgpIHtcbiAgICBpZih0aGlzLl9hdmNJZCA9PT0gLTEpIHtcbiAgICAgIC8vYXVkaW8gb25seVxuICAgICAgaWYodGhpcy5fYWFjVHJhY2suY29uZmlnKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQse1xuICAgICAgICAgIGF1ZGlvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hYWNUcmFja10pLFxuICAgICAgICAgIGF1ZGlvQ29kZWMgOiB0aGlzLl9hYWNUcmFjay5jb2RlYyxcbiAgICAgICAgICBhdWRpb0NoYW5uZWxDb3VudCA6IHRoaXMuX2FhY1RyYWNrLmNoYW5uZWxDb3VudFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5fYWFjU2FtcGxlc1swXS5wdHMgLSB0aGlzLlBFU19USU1FU0NBTEUqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICB0aGlzLl9pbml0RFRTID0gdGhpcy5fYWFjU2FtcGxlc1swXS5kdHMgLSB0aGlzLlBFU19USU1FU0NBTEUqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgfVxuICAgIH0gZWxzZVxuICAgIGlmKHRoaXMuX2FhY0lkID09PSAtMSkge1xuICAgICAgLy92aWRlbyBvbmx5XG4gICAgICBpZih0aGlzLl9hdmNUcmFjay5zcHMgJiYgdGhpcy5fYXZjVHJhY2sucHBzKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQse1xuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzIC0gdGhpcy5QRVNfVElNRVNDQUxFKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gdGhpcy5fYXZjU2FtcGxlc1swXS5kdHMgLSB0aGlzLlBFU19USU1FU0NBTEUqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vYXVkaW8gYW5kIHZpZGVvXG4gICAgICBpZih0aGlzLl9hYWNUcmFjay5jb25maWcgJiYgdGhpcy5fYXZjVHJhY2suc3BzICYmIHRoaXMuX2F2Y1RyYWNrLnBwcykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULHtcbiAgICAgICAgICBhdWRpb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYWFjVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjIDogdGhpcy5fYWFjVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQgOiB0aGlzLl9hYWNUcmFjay5jaGFubmVsQ291bnQsXG4gICAgICAgICAgdmlkZW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2F2Y1RyYWNrXSksXG4gICAgICAgICAgdmlkZW9Db2RlYyA6IHRoaXMuX2F2Y1RyYWNrLmNvZGVjLFxuICAgICAgICAgIHZpZGVvV2lkdGggOiB0aGlzLl9hdmNUcmFjay53aWR0aCxcbiAgICAgICAgICB2aWRlb0hlaWdodCA6IHRoaXMuX2F2Y1RyYWNrLmhlaWdodFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICAgIGlmKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgICB0aGlzLl9pbml0UFRTID0gTWF0aC5taW4odGhpcy5fYXZjU2FtcGxlc1swXS5wdHMsdGhpcy5fYWFjU2FtcGxlc1swXS5wdHMpIC0gdGhpcy5QRVNfVElNRVNDQUxFKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gTWF0aC5taW4odGhpcy5fYXZjU2FtcGxlc1swXS5kdHMsdGhpcy5fYWFjU2FtcGxlc1swXS5kdHMpIC0gdGhpcy5QRVNfVElNRVNDQUxFKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXI7XG4iLCIgaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IFRTRGVtdXhlciAgICAgICAgICAgIGZyb20gJy4uL2RlbXV4L3RzZGVtdXhlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcblxudmFyIFRTRGVtdXhlcldvcmtlciA9IGZ1bmN0aW9uIChzZWxmKSB7XG4gICAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJyxmdW5jdGlvbiAoZXYpIHtcbiAgICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBldi5kYXRhLmNtZCk7XG4gICAgICBzd2l0Y2goZXYuZGF0YS5jbWQpIHtcbiAgICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgICAgc2VsZi5kZW11eGVyID0gbmV3IFRTRGVtdXhlcigpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkZW11eCc6XG4gICAgICAgICAgc2VsZi5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5kYXRhKSwgZXYuZGF0YS5hdWRpb0NvZGVjLGV2LmRhdGEudmlkZW9Db2RlYywgZXYuZGF0YS50aW1lT2Zmc2V0LCBldi5kYXRhLmNjLCBldi5kYXRhLmxldmVsLCBldi5kYXRhLmR1cmF0aW9uKTtcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIuZW5kKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBsaXN0ZW4gdG8gZXZlbnRzIHRyaWdnZXJlZCBieSBUUyBEZW11eGVyXG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgZnVuY3Rpb24oZXYsZGF0YSkge1xuICAgICAgdmFyIG9iakRhdGEgPSB7IGV2ZW50IDogZXYgfTtcbiAgICAgIHZhciBvYmpUcmFuc2ZlcmFibGUgPSBbXTtcbiAgICAgIGlmKGRhdGEuYXVkaW9Db2RlYykge1xuICAgICAgICBvYmpEYXRhLmF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgICAgIG9iakRhdGEuYXVkaW9Nb292ID0gZGF0YS5hdWRpb01vb3YuYnVmZmVyO1xuICAgICAgICBvYmpEYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID0gZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS5hdWRpb01vb3YpO1xuICAgICAgfVxuICAgICAgaWYoZGF0YS52aWRlb0NvZGVjKSB7XG4gICAgICAgIG9iakRhdGEudmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgb2JqRGF0YS52aWRlb01vb3YgPSBkYXRhLnZpZGVvTW9vdi5idWZmZXI7XG4gICAgICAgIG9iakRhdGEudmlkZW9XaWR0aCA9IGRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgb2JqRGF0YS52aWRlb0hlaWdodCA9IGRhdGEudmlkZW9IZWlnaHQ7XG4gICAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEudmlkZW9Nb292KTtcbiAgICAgIH1cbiAgICAgIC8vIHBhc3MgbW9vdiBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLG9ialRyYW5zZmVyYWJsZSk7XG4gICAgfSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIGZ1bmN0aW9uKGV2LGRhdGEpIHtcbiAgICAgIHZhciBvYmpEYXRhID0geyBldmVudCA6IGV2ICwgdHlwZSA6IGRhdGEudHlwZSwgc3RhcnRQVFMgOiBkYXRhLnN0YXJ0UFRTLCBlbmRQVFMgOiBkYXRhLmVuZFBUUyAsIHN0YXJ0RFRTIDogZGF0YS5zdGFydERUUywgZW5kRFRTIDogZGF0YS5lbmREVFMgLG1vb2YgOiBkYXRhLm1vb2YuYnVmZmVyLCBtZGF0IDogZGF0YS5tZGF0LmJ1ZmZlciwgbmIgOiBkYXRhLm5ifTtcbiAgICAgIC8vIHBhc3MgbW9vZi9tZGF0IGRhdGEgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSxbb2JqRGF0YS5tb29mLG9iakRhdGEubWRhdF0pO1xuICAgIH0pO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCBmdW5jdGlvbihldmVudCkge1xuICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6ZXZlbnR9KTtcbiAgICB9KTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgZnVuY3Rpb24oZXZlbnQsZGF0YSkge1xuICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6ZXZlbnQsZGF0YTpkYXRhfSk7XG4gICAgfSk7XG4gIH07XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcldvcmtlcjtcblxuIiwiXG5leHBvcnQgdmFyIEVycm9yVHlwZXMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbmV0d29yayBlcnJvciAobG9hZGluZyBlcnJvciAvIHRpbWVvdXQgLi4uKVxuICBORVRXT1JLX0VSUk9SIDogICdobHNOZXR3b3JrRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1lZGlhIEVycm9yICh2aWRlby9wYXJzaW5nL21lZGlhc291cmNlIGVycm9yKVxuICBNRURJQV9FUlJPUiA6ICAnaGxzTWVkaWFFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFsbCBvdGhlciBlcnJvcnNcbiAgT1RIRVJfRVJST1IgOiAgJ2hsc090aGVyRXJyb3InXG59O1xuXG5leHBvcnQgdmFyIEVycm9yRGV0YWlscyA9IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTUFOSUZFU1RfTE9BRF9FUlJPUiA6ICAnbWFuaWZlc3RMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfVElNRU9VVCA6ICAnbWFuaWZlc3RMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgcGFyc2luZyBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVhc29uIDogZXJyb3IgcmVhc29ufVxuICBNQU5JRkVTVF9QQVJTSU5HX0VSUk9SIDogICdtYW5pZmVzdFBhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX0VSUk9SIDogICdsZXZlbExvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIExFVkVMX0xPQURfVElNRU9VVCA6ICAnbGV2ZWxMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGVycm9yIC0gZGF0YTogeyBsZXZlbCA6IGZhdWx0eSBsZXZlbCBJZCwgZXZlbnQgOiBlcnJvciBkZXNjcmlwdGlvbn1cbiAgTEVWRUxfU1dJVENIX0VSUk9SIDogICdsZXZlbFN3aXRjaEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9FUlJPUiA6ICAnZnJhZ0xvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvb3AgbG9hZGluZyBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT09QX0xPQURJTkdfRVJST1IgOiAgJ2ZyYWdMb29wTG9hZGluZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfVElNRU9VVCA6ICAnZnJhZ0xvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1IgOiAgJ2ZyYWdQYXJzaW5nRXJyb3InLFxuICAgIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgYXBwZW5kaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogYXBwZW5kaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEZSQUdfQVBQRU5ESU5HX0VSUk9SIDogICdmcmFnQXBwZW5kaW5nRXJyb3InXG59O1xuIiwiZXhwb3J0IGRlZmF1bHQge1xuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIHN1Y2Nlc2Z1bGx5IGF0dGFjaGVkIHRvIHZpZGVvIGVsZW1lbnQgLSBkYXRhOiB7IG1lZGlhU291cmNlIH1cbiAgTVNFX0FUVEFDSEVEIDogJ2hsc01lZGlhU291cmNlQXR0YWNoZWQnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIGRldGFjaGVkIGZyb20gdmlkZW8gZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNU0VfREVUQUNIRUQgOiAnaGxzTWVkaWFTb3VyY2VEZXRhY2hlZCcsXG4gIC8vIGZpcmVkIHRvIHNpZ25hbCB0aGF0IGEgbWFuaWZlc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IG1hbmlmZXN0VVJMfVxuICBNQU5JRkVTVF9MT0FESU5HICA6ICdobHNNYW5pZmVzdExvYWRpbmcnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBsb2FkZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgdXJsIDogbWFuaWZlc3RVUkwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9fVxuICBNQU5JRkVTVF9MT0FERUQgIDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gcGFyc2VkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIGZpcnN0TGV2ZWwgOiBpbmRleCBvZiBmaXJzdCBxdWFsaXR5IGxldmVsIGFwcGVhcmluZyBpbiBNYW5pZmVzdH1cbiAgTUFOSUZFU1RfUEFSU0VEICA6ICdobHNNYW5pZmVzdFBhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgdXJsIDogbGV2ZWwgVVJMICBsZXZlbCA6IGlkIG9mIGxldmVsIGJlaW5nIGxvYWRlZH1cbiAgTEVWRUxfTE9BRElORyAgICA6ICdobHNMZXZlbExvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBmaW5pc2hlcyAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgbG9hZGVkIGxldmVsLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfSB9XG4gIExFVkVMX0xPQURFRCA6ICAnaGxzTGV2ZWxMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgc3dpdGNoIGlzIHJlcXVlc3RlZCAtIGRhdGE6IHsgbGV2ZWwgOiBpZCBvZiBuZXcgbGV2ZWwgfVxuICBMRVZFTF9TV0lUQ0ggOiAgJ2hsc0xldmVsU3dpdGNoJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURJTkcgOiAgJ2hsc0ZyYWdMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgcHJvZ3Jlc3NpbmcgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHsgdHJlcXVlc3QsIHRmaXJzdCwgbG9hZGVkfX1cbiAgRlJBR19MT0FEX1BST0dSRVNTIDogICdobHNGcmFnTG9hZFByb2dyZXNzJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBhYm9ydGluZyBmb3IgZW1lcmdlbmN5IHN3aXRjaCBkb3duIC0gZGF0YToge2ZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCA6ICAnaGxzRnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBwYXlsb2FkIDogZnJhZ21lbnQgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBGUkFHX0xPQURFRCA6ICAnaGxzRnJhZ0xvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCA6ICAnaGxzRnJhZ1BhcnNpbmdJbml0U2VnbWVudCcsXG4gIC8vIGZpcmVkIHdoZW4gbW9vZi9tZGF0IGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vZiA6IG1vb2YgTVA0IGJveCwgbWRhdCA6IG1kYXQgTVA0IGJveH1cbiAgRlJBR19QQVJTSU5HX0RBVEEgOiAgJ2hsc0ZyYWdQYXJzaW5nRGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcGFyc2luZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB1bmRlZmluZWRcbiAgRlJBR19QQVJTRUQgOiAgJ2hsc0ZyYWdQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHJlbXV4ZWQgTVA0IGJveGVzIGhhdmUgYWxsIGJlZW4gYXBwZW5kZWQgaW50byBTb3VyY2VCdWZmZXIgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgdHBhcnNlZCwgdGJ1ZmZlcmVkLCBsZW5ndGh9IH1cbiAgRlJBR19CVUZGRVJFRCA6ICAnaGxzRnJhZ0J1ZmZlcmVkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBtYXRjaGluZyB3aXRoIGN1cnJlbnQgdmlkZW8gcG9zaXRpb24gaXMgY2hhbmdpbmcgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19DSEFOR0VEIDogICdobHNGcmFnQ2hhbmdlZCcsXG4gICAgLy8gSWRlbnRpZmllciBmb3IgYSBGUFMgZHJvcCBldmVudCAtIGRhdGE6IHtjdXJlbnREcm9wcGVkLCBjdXJyZW50RGVjb2RlZCwgdG90YWxEcm9wcGVkRnJhbWVzfVxuICBGUFNfRFJPUCA6ICAnaGxzRlBTRHJvcCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFuIGVycm9yIGV2ZW50IC0gZGF0YTogeyB0eXBlIDogZXJyb3IgdHlwZSwgZGV0YWlscyA6IGVycm9yIGRldGFpbHMsIGZhdGFsIDogaWYgdHJ1ZSwgaGxzLmpzIGNhbm5vdC93aWxsIG5vdCB0cnkgdG8gcmVjb3ZlciwgaWYgZmFsc2UsIGhscy5qcyB3aWxsIHRyeSB0byByZWNvdmVyLG90aGVyIGVycm9yIHNwZWNpZmljIGRhdGF9XG4gIEVSUk9SIDogJ2hsc0Vycm9yJ1xufTtcbiIsIi8qKlxuICogSExTIGludGVyZmFjZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgICAgICAgICAgICBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsRXJyb3JEZXRhaWxzfSAgZnJvbSAnLi9lcnJvcnMnO1xuaW1wb3J0IFN0YXRzSGFuZGxlciAgICAgICAgICAgICAgIGZyb20gJy4vc3RhdHMnO1xuaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgICAgICAgIGZyb20gJy4vb2JzZXJ2ZXInO1xuaW1wb3J0IFBsYXlsaXN0TG9hZGVyICAgICAgICAgICAgIGZyb20gJy4vbG9hZGVyL3BsYXlsaXN0LWxvYWRlcic7XG5pbXBvcnQgRnJhZ21lbnRMb2FkZXIgICAgICAgICAgICAgZnJvbSAnLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbmltcG9ydCBCdWZmZXJDb250cm9sbGVyICAgICAgICAgICBmcm9tICcuL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXInO1xuaW1wb3J0IExldmVsQ29udHJvbGxlciAgICAgICAgICAgIGZyb20gJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbi8vaW1wb3J0IEZQU0NvbnRyb2xsZXIgICAgICAgICAgICAgIGZyb20gJy4vY29udHJvbGxlci9mcHMtY29udHJvbGxlcic7XG5pbXBvcnQge2xvZ2dlcixlbmFibGVMb2dzfSAgICAgICAgZnJvbSAnLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IFhockxvYWRlciAgICAgICAgICAgICAgICAgIGZyb20gJy4vdXRpbHMveGhyLWxvYWRlcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0OyBjb2RlY3M9XCJhdmMxLjQyRTAxRSxtcDRhLjQwLjJcIicpKTtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXZlbnRzKCkge1xuICAgIHJldHVybiBFdmVudDtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXJyb3JUeXBlcygpIHtcbiAgICByZXR1cm4gRXJyb3JUeXBlcztcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXJyb3JEZXRhaWxzKCkge1xuICAgIHJldHVybiBFcnJvckRldGFpbHM7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSkge1xuICAgdmFyIGNvbmZpZ0RlZmF1bHQgPSB7XG4gICAgICBhdXRvU3RhcnRMb2FkIDogdHJ1ZSxcbiAgICAgIGRlYnVnIDogZmFsc2UsXG4gICAgICBtYXhCdWZmZXJMZW5ndGggOiAzMCxcbiAgICAgIG1heEJ1ZmZlclNpemUgOiA2MCoxMDAwKjEwMDAsXG4gICAgICBtYXhNYXhCdWZmZXJMZW5ndGggOiA2MDAsXG4gICAgICBlbmFibGVXb3JrZXIgOiB0cnVlLFxuICAgICAgZnJhZ0xvYWRpbmdUaW1lT3V0IDogMjAwMDAsXG4gICAgICBmcmFnTG9hZGluZ01heFJldHJ5IDogMSxcbiAgICAgIGZyYWdMb2FkaW5nUmV0cnlEZWxheSA6IDEwMDAsXG4gICAgICBmcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQgOiAzLFxuICAgICAgbWFuaWZlc3RMb2FkaW5nVGltZU91dCA6IDEwMDAwLFxuICAgICAgbWFuaWZlc3RMb2FkaW5nTWF4UmV0cnkgOiAxLFxuICAgICAgbWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheSA6IDEwMDAsXG4gICAgICBmcHNEcm9wcGVkTW9uaXRvcmluZ1BlcmlvZCA6IDUwMDAsXG4gICAgICBmcHNEcm9wcGVkTW9uaXRvcmluZ1RocmVzaG9sZCA6IDAuMixcbiAgICAgIGFwcGVuZEVycm9yTWF4UmV0cnkgOiAyMDAsXG4gICAgICBsb2FkZXIgOiBYaHJMb2FkZXJcbiAgICB9O1xuICAgIGZvciAodmFyIHByb3AgaW4gY29uZmlnRGVmYXVsdCkge1xuICAgICAgICBpZiAocHJvcCBpbiBjb25maWcpIHsgY29udGludWU7IH1cbiAgICAgICAgY29uZmlnW3Byb3BdID0gY29uZmlnRGVmYXVsdFtwcm9wXTtcbiAgICB9XG4gICAgZW5hYmxlTG9ncyhjb25maWcuZGVidWcpO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBuZXcgUGxheWxpc3RMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlciA9IG5ldyBGcmFnbWVudExvYWRlcih0aGlzKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IG5ldyBMZXZlbENvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyID0gbmV3IEJ1ZmZlckNvbnRyb2xsZXIodGhpcyk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIgPSBuZXcgRlBTQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLnN0YXRzSGFuZGxlciA9IG5ldyBTdGF0c0hhbmRsZXIodGhpcyk7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5vZmYuYmluZChvYnNlcnZlcik7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGxvZ2dlci5sb2coYGRlc3Ryb3lgKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5zdGF0c0hhbmRsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMudXJsID0gbnVsbDtcbiAgICB0aGlzLmRldGFjaFZpZGVvKCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hWaWRlbyh2aWRlbykge1xuICAgIGxvZ2dlci5sb2coYGF0dGFjaFZpZGVvYCk7XG4gICAgdGhpcy52aWRlbyA9IHZpZGVvO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyLmF0dGFjaFZpZGVvKHZpZGVvKTtcbiAgICAvLyBzZXR1cCB0aGUgbWVkaWEgc291cmNlXG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIC8vTWVkaWEgU291cmNlIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc28gPSB0aGlzLm9uTWVkaWFTb3VyY2VPcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NZWRpYVNvdXJjZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zYyA9IHRoaXMub25NZWRpYVNvdXJjZUNsb3NlLmJpbmQodGhpcyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgdmlkZW8uc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLHRoaXMub252ZXJyb3IpO1xuICB9XG5cbiAgZGV0YWNoVmlkZW8oKSB7XG4gICAgbG9nZ2VyLmxvZyhgZGV0YWNoVmlkZW9gKTtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyLmRldGFjaFZpZGVvKHZpZGVvKTtcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmKG1zKSB7XG4gICAgICBpZihtcy5yZWFkeVN0YXRlICE9PSAnZW5kZWQnKSB7XG4gICAgICAgIG1zLmVuZE9mU3RyZWFtKCk7XG4gICAgICB9XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgIHRoaXMub25tc28pO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgICAvLyB1bmxpbmsgTWVkaWFTb3VyY2UgZnJvbSB2aWRlbyB0YWdcbiAgICAgIHZpZGVvLnNyYyA9ICcnO1xuICAgICAgdGhpcy5tZWRpYVNvdXJjZSA9IG51bGw7XG4gICAgICBsb2dnZXIubG9nKGB0cmlnZ2VyIE1TRV9ERVRBQ0hFRGApO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NU0VfREVUQUNIRUQpO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIGlmKHZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBsb2FkU291cmNlKHVybCkge1xuICAgIGxvZ2dlci5sb2coYGxvYWRTb3VyY2U6JHt1cmx9YCk7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgLy8gd2hlbiBhdHRhY2hpbmcgdG8gYSBzb3VyY2UgVVJMLCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZFxuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BRElORywgeyB1cmw6IHVybCB9KTtcbiAgfVxuXG4gIHN0YXJ0TG9hZCgpIHtcbiAgICBsb2dnZXIubG9nKGBzdGFydExvYWRgKTtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIuc3RhcnRMb2FkKCk7XG4gIH1cblxuICByZWNvdmVyTWVkaWFFcnJvcigpIHtcbiAgICBsb2dnZXIubG9nKCdyZWNvdmVyTWVkaWFFcnJvcicpO1xuICAgIHZhciB2aWRlbyA9IHRoaXMudmlkZW87XG4gICAgdGhpcy5kZXRhY2hWaWRlbygpO1xuICAgIHRoaXMuYXR0YWNoVmlkZW8odmlkZW8pO1xuICB9XG5cbiAgLyoqIFJldHVybiBhbGwgcXVhbGl0eSBsZXZlbHMgKiovXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVscztcbiAgfVxuXG4gIC8qKiBSZXR1cm4gY3VycmVudCBwbGF5YmFjayBxdWFsaXR5IGxldmVsICoqL1xuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIuY3VycmVudExldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgaW1tZWRpYXRlbHkgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgY3VycmVudExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGN1cnJlbnRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubG9hZExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyLmltbWVkaWF0ZUxldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIG5leHQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAocXVhbGl0eSBsZXZlbCBvZiBuZXh0IGZyYWdtZW50KSAqKi9cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXJDb250cm9sbGVyLm5leHRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBuZXh0IGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IG5leHRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBuZXh0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgY3VycmVudC9sYXN0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IGxvYWRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgY3VycmVudC9uZXh0IGxvYWRlZCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBsb2FkTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgbG9hZExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBuZXh0TG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5uZXh0TG9hZExldmVsKCk7XG4gIH1cblxuICAvKiogc2V0IHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIHNldCBuZXh0TG9hZExldmVsKGxldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWwgPSBsZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gZmlyc3QgbGV2ZWwgKGluZGV4IG9mIGZpcnN0IGxldmVsIHJlZmVyZW5jZWQgaW4gbWFuaWZlc3QpXG4gICoqL1xuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuZmlyc3RMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgZmlyc3QgbGV2ZWwgKGluZGV4IG9mIGZpcnN0IGxldmVsIHJlZmVyZW5jZWQgaW4gbWFuaWZlc3QpXG4gICoqL1xuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBmaXJzdExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBzdGFydCBsZXZlbCAobGV2ZWwgb2YgZmlyc3QgZnJhZ21lbnQgdGhhdCB3aWxsIGJlIHBsYXllZCBiYWNrKVxuICAgICAgaWYgbm90IG92ZXJyaWRlZCBieSB1c2VyLCBmaXJzdCBsZXZlbCBhcHBlYXJpbmcgaW4gbWFuaWZlc3Qgd2lsbCBiZSB1c2VkIGFzIHN0YXJ0IGxldmVsXG4gICAgICBpZiAtMSA6IGF1dG9tYXRpYyBzdGFydCBsZXZlbCBzZWxlY3Rpb24sIHBsYXliYWNrIHdpbGwgc3RhcnQgZnJvbSBsZXZlbCBtYXRjaGluZyBkb3dubG9hZCBiYW5kd2lkdGggKGRldGVybWluZWQgZnJvbSBkb3dubG9hZCBvZiBmaXJzdCBzZWdtZW50KVxuICAqKi9cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0ICBzdGFydCBsZXZlbCAobGV2ZWwgb2YgZmlyc3QgZnJhZ21lbnQgdGhhdCB3aWxsIGJlIHBsYXllZCBiYWNrKVxuICAgICAgaWYgbm90IG92ZXJyaWRlZCBieSB1c2VyLCBmaXJzdCBsZXZlbCBhcHBlYXJpbmcgaW4gbWFuaWZlc3Qgd2lsbCBiZSB1c2VkIGFzIHN0YXJ0IGxldmVsXG4gICAgICBpZiAtMSA6IGF1dG9tYXRpYyBzdGFydCBsZXZlbCBzZWxlY3Rpb24sIHBsYXliYWNrIHdpbGwgc3RhcnQgZnJvbSBsZXZlbCBtYXRjaGluZyBkb3dubG9hZCBiYW5kd2lkdGggKGRldGVybWluZWQgZnJvbSBkb3dubG9hZCBvZiBmaXJzdCBzZWdtZW50KVxuICAqKi9cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgc3RhcnRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGF1dG9MZXZlbENhcHBpbmc6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiBjaGVjayBpZiB3ZSBhcmUgaW4gYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBtb2RlICovXG4gIGdldCBhdXRvTGV2ZWxFbmFibGVkKCkge1xuICAgIHJldHVybiAodGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgID09PSAtMSk7XG4gIH1cblxuICAvKiByZXR1cm4gbWFudWFsIGxldmVsICovXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWw7XG4gIH1cblxuXG4gIC8qIHJldHVybiBwbGF5YmFjayBzZXNzaW9uIHN0YXRzICovXG4gIGdldCBzdGF0cygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0c0hhbmRsZXIuc3RhdHM7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2Ugb3BlbmVkJyk7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NU0VfQVRUQUNIRUQsIHsgdmlkZW86IHRoaXMudmlkZW8sIG1lZGlhU291cmNlIDogdGhpcy5tZWRpYVNvdXJjZSB9KTtcbiAgICAvLyBvbmNlIHJlY2VpdmVkLCBkb24ndCBsaXN0ZW4gYW55bW9yZSB0byBzb3VyY2VvcGVuIGV2ZW50XG4gICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgIHRoaXMub25tc28pO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZUNsb3NlKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBjbG9zZWQnKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VFbmRlZCgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgZW5kZWQnKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBIbHM7XG4iLCIgLypcbiAqIGZyYWdtZW50IGxvYWRlclxuICpcbiAqL1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgRnJhZ21lbnRMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzPWhscztcbiAgICB0aGlzLm9uZmwgPSB0aGlzLm9uRnJhZ0xvYWRpbmcuYmluZCh0aGlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURJTkcsIHRoaXMub25mbCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX0xPQURJTkcsIHRoaXMub25mbCk7XG4gIH1cblxuICBvbkZyYWdMb2FkaW5nKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgZnJhZyA9IGRhdGEuZnJhZztcbiAgICB0aGlzLmZyYWcgPSBmcmFnO1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSAwO1xuICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWc7XG4gICAgZnJhZy5sb2FkZXIgPSB0aGlzLmxvYWRlciA9IG5ldyBjb25maWcubG9hZGVyKCk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwnYXJyYXlidWZmZXInLHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKSwgdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKSwgdGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCBjb25maWcuZnJhZ0xvYWRpbmdUaW1lT3V0LCBjb25maWcuZnJhZ0xvYWRpbmdNYXhSZXRyeSxjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcykpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIHN0YXRzLmxlbmd0aCA9IHBheWxvYWQuYnl0ZUxlbmd0aDtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIHRoaXMuZnJhZy5sb2FkZXIgPSB1bmRlZmluZWQ7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgeyBwYXlsb2FkIDogcGF5bG9hZCxcbiAgICAgICAgICAgICAgICAgICAgICBmcmFnIDogdGhpcy5mcmFnICxcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHsgdHlwZSA6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IsIGZhdGFsOmZhbHNlLGZyYWcgOiB0aGlzLmZyYWcsIHJlc3BvbnNlOmV2ZW50fSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHsgdHlwZSA6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVCwgZmF0YWw6ZmFsc2UsZnJhZyA6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSBzdGF0cy5sb2FkZWQ7XG4gICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywgeyBmcmFnIDogdGhpcy5mcmFnLCBzdGF0cyA6IHN0YXRzfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRnJhZ21lbnRMb2FkZXI7XG4iLCIvKlxuICogcGxheWxpc3QgbG9hZGVyXG4gKlxuICovXG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbmltcG9ydCB7RXJyb3JUeXBlcyxFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG4vL2ltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4gY2xhc3MgUGxheWxpc3RMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25tbCA9IHRoaXMub25NYW5pZmVzdExvYWRpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5MRVZFTF9MT0FESU5HLCB0aGlzLm9ubGwpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnVybCA9IHRoaXMuaWQgPSBudWxsO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5NQU5JRkVTVF9MT0FESU5HLCB0aGlzLm9ubWwpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5MRVZFTF9MT0FESU5HLCB0aGlzLm9ubGwpO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRpbmcoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMubG9hZChkYXRhLnVybCxudWxsKTtcbiAgfVxuXG4gIG9uTGV2ZWxMb2FkaW5nKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsZGF0YS5sZXZlbCxkYXRhLmlkKTtcbiAgfVxuXG4gIGxvYWQodXJsLGlkMSxpZDIpIHtcbiAgICB2YXIgY29uZmlnPXRoaXMuaGxzLmNvbmZpZztcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLmlkID0gaWQxO1xuICAgIHRoaXMuaWQyID0gaWQyO1xuICAgIHRoaXMubG9hZGVyID0gbmV3IGNvbmZpZy5sb2FkZXIoKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwnJyx0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLm1hbmlmZXN0TG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5tYW5pZmVzdExvYWRpbmdNYXhSZXRyeSxjb25maWcubWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheSk7XG4gIH1cblxuICByZXNvbHZlKHVybCwgYmFzZVVybCkge1xuICAgIHZhciBkb2MgICAgICA9IGRvY3VtZW50LFxuICAgICAgICBvbGRCYXNlID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdiYXNlJylbMF0sXG4gICAgICAgIG9sZEhyZWYgPSBvbGRCYXNlICYmIG9sZEJhc2UuaHJlZixcbiAgICAgICAgZG9jSGVhZCA9IGRvYy5oZWFkIHx8IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdLFxuICAgICAgICBvdXJCYXNlID0gb2xkQmFzZSB8fCBkb2NIZWFkLmFwcGVuZENoaWxkKGRvYy5jcmVhdGVFbGVtZW50KCdiYXNlJykpLFxuICAgICAgICByZXNvbHZlciA9IGRvYy5jcmVhdGVFbGVtZW50KCdhJyksXG4gICAgICAgIHJlc29sdmVkVXJsO1xuXG4gICAgb3VyQmFzZS5ocmVmID0gYmFzZVVybDtcbiAgICByZXNvbHZlci5ocmVmID0gdXJsO1xuICAgIHJlc29sdmVkVXJsICA9IHJlc29sdmVyLmhyZWY7IC8vIGJyb3dzZXIgbWFnaWMgYXQgd29yayBoZXJlXG5cbiAgICBpZiAob2xkQmFzZSkge29sZEJhc2UuaHJlZiA9IG9sZEhyZWY7fVxuICAgIGVsc2Uge2RvY0hlYWQucmVtb3ZlQ2hpbGQob3VyQmFzZSk7fVxuICAgIHJldHVybiByZXNvbHZlZFVybDtcbiAgfVxuXG4gIHBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLGJhc2V1cmwpIHtcbiAgICB2YXIgbGV2ZWxzID0gW10sbGV2ZWwgPSAge30scmVzdWx0LGNvZGVjcyxjb2RlYztcbiAgICB2YXIgcmUgPSAvI0VYVC1YLVNUUkVBTS1JTkY6KFteXFxuXFxyXSooQkFORClXSURUSD0oXFxkKykpPyhbXlxcblxccl0qKENPREVDUyk9XFxcIiguKilcXFwiLCk/KFteXFxuXFxyXSooUkVTKU9MVVRJT049KFxcZCspeChcXGQrKSk/KFteXFxuXFxyXSooTkFNRSk9XFxcIiguKilcXFwiKT9bXlxcblxccl0qW1xcclxcbl0rKFteXFxyXFxuXSspL2c7XG4gICAgd2hpbGUoKHJlc3VsdCA9IHJlLmV4ZWMoc3RyaW5nKSkgIT0gbnVsbCl7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obil7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTt9KTtcbiAgICAgIGxldmVsLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHQucG9wKCksYmFzZXVybCk7XG4gICAgICB3aGlsZShyZXN1bHQubGVuZ3RoID4gMCkge1xuICAgICAgICBzd2l0Y2gocmVzdWx0LnNoaWZ0KCkpIHtcbiAgICAgICAgICBjYXNlICdSRVMnOlxuICAgICAgICAgICAgbGV2ZWwud2lkdGggPSBwYXJzZUludChyZXN1bHQuc2hpZnQoKSk7XG4gICAgICAgICAgICBsZXZlbC5oZWlnaHQgPSBwYXJzZUludChyZXN1bHQuc2hpZnQoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdCQU5EJzpcbiAgICAgICAgICAgIGxldmVsLmJpdHJhdGUgPSBwYXJzZUludChyZXN1bHQuc2hpZnQoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdOQU1FJzpcbiAgICAgICAgICAgIGxldmVsLm5hbWUgPSByZXN1bHQuc2hpZnQoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0NPREVDUyc6XG4gICAgICAgICAgICBjb2RlY3MgPSByZXN1bHQuc2hpZnQoKS5zcGxpdCgnLCcpO1xuICAgICAgICAgICAgd2hpbGUoY29kZWNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgY29kZWMgPSBjb2RlY3Muc2hpZnQoKTtcbiAgICAgICAgICAgICAgaWYoY29kZWMuaW5kZXhPZignYXZjMScpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGxldmVsLnZpZGVvQ29kZWMgPSB0aGlzLmF2YzF0b2F2Y290aShjb2RlYyk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwuYXVkaW9Db2RlYyA9IGNvZGVjO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgIGxldmVsID0ge307XG4gICAgfVxuICAgIHJldHVybiBsZXZlbHM7XG4gIH1cblxuICBhdmMxdG9hdmNvdGkoY29kZWMpIHtcbiAgICB2YXIgcmVzdWx0LGF2Y2RhdGEgPSBjb2RlYy5zcGxpdCgnLicpO1xuICAgIGlmKGF2Y2RhdGEubGVuZ3RoID4gMikge1xuICAgICAgcmVzdWx0ID0gYXZjZGF0YS5zaGlmdCgpICsgJy4nO1xuICAgICAgcmVzdWx0ICs9IHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpO1xuICAgICAgcmVzdWx0ICs9ICgnMDAnICsgcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNikpLnN1YnN0cigtNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGNvZGVjO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgYmFzZXVybCwgaWQpIHtcbiAgICB2YXIgY3VycmVudFNOID0gMCx0b3RhbGR1cmF0aW9uID0gMCwgbGV2ZWwgPSB7IHVybCA6IGJhc2V1cmwsIGZyYWdtZW50cyA6IFtdLCBsaXZlIDogdHJ1ZSwgc3RhcnRTTiA6IDB9LCByZXN1bHQsIHJlZ2V4cCwgY2MgPSAwO1xuICAgIHJlZ2V4cCA9IC8oPzojRVhULVgtKE1FRElBLVNFUVVFTkNFKTooXFxkKykpfCg/OiNFWFQtWC0oVEFSR0VURFVSQVRJT04pOihcXGQrKSl8KD86I0VYVChJTkYpOihbXFxkXFwuXSspW15cXHJcXG5dKltcXHJcXG5dKyhbXlxcclxcbl0rKXwoPzojRVhULVgtKEVORExJU1QpKXwoPzojRVhULVgtKERJUylDT05USU5VSVRZKSkvZztcbiAgICB3aGlsZSgocmVzdWx0ID0gcmVnZXhwLmV4ZWMoc3RyaW5nKSkgIT09IG51bGwpe1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4peyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7fSk7XG4gICAgICBzd2l0Y2gocmVzdWx0WzBdKSB7XG4gICAgICAgIGNhc2UgJ01FRElBLVNFUVVFTkNFJzpcbiAgICAgICAgICBjdXJyZW50U04gPSBsZXZlbC5zdGFydFNOID0gcGFyc2VJbnQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnVEFSR0VURFVSQVRJT04nOlxuICAgICAgICAgIGxldmVsLnRhcmdldGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFTkRMSVNUJzpcbiAgICAgICAgICBsZXZlbC5saXZlID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0RJUyc6XG4gICAgICAgICAgY2MrKztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnSU5GJzpcbiAgICAgICAgICB2YXIgZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgbGV2ZWwuZnJhZ21lbnRzLnB1c2goe3VybCA6IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sYmFzZXVybCksIGR1cmF0aW9uIDogZHVyYXRpb24sIHN0YXJ0IDogdG90YWxkdXJhdGlvbiwgc24gOiBjdXJyZW50U04rKywgbGV2ZWw6aWQsIGNjIDogY2N9KTtcbiAgICAgICAgICB0b3RhbGR1cmF0aW9uKz1kdXJhdGlvbjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmb3VuZCAnICsgbGV2ZWwuZnJhZ21lbnRzLmxlbmd0aCArICcgZnJhZ21lbnRzJyk7XG4gICAgbGV2ZWwudG90YWxkdXJhdGlvbiA9IHRvdGFsZHVyYXRpb247XG4gICAgbGV2ZWwuZW5kU04gPSBjdXJyZW50U04gLSAxO1xuICAgIHJldHVybiBsZXZlbDtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciBzdHJpbmcgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlVGV4dCwgdXJsID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVVSTCwgaWQgPSB0aGlzLmlkLGlkMj0gdGhpcy5pZDIsIGxldmVscztcbiAgICAvLyByZXNwb25zZVVSTCBub3Qgc3VwcG9ydGVkIG9uIHNvbWUgYnJvd3NlcnMgKGl0IGlzIHVzZWQgdG8gZGV0ZWN0IFVSTCByZWRpcmVjdGlvbilcbiAgICBpZih1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFsbGJhY2sgdG8gaW5pdGlhbCBVUkxcbiAgICAgIHVybCA9IHRoaXMudXJsO1xuICAgIH1cbiAgICBzdGF0cy50bG9hZCA9IG5ldyBEYXRlKCk7XG4gICAgc3RhdHMubXRpbWUgPSBuZXcgRGF0ZShldmVudC5jdXJyZW50VGFyZ2V0LmdldFJlc3BvbnNlSGVhZGVyKCdMYXN0LU1vZGlmaWVkJykpO1xuXG4gICAgaWYoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCBsZXZlbCB3aWxsIGJlIHJlbG9hZGVkIGFmdGVyd2FyZHNcbiAgICAgICAgLy8gKHRoaXMgaXMgdG8gaGF2ZSBhIHVuaWZvcm0gbG9naWMgZm9yIDEgbGV2ZWwvbXVsdGlsZXZlbCBwbGF5bGlzdHMpXG4gICAgICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiBbe3VybCA6IHVybH1dLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgZGV0YWlscyA6IHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZyx1cmwsaWQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsIDogaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQgOiBpZDIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiBzdGF0c30pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHMgPSB0aGlzLnBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLHVybCk7XG4gICAgICAgIC8vIG11bHRpIGxldmVsIHBsYXlsaXN0LCBwYXJzZSBsZXZlbCBpbmZvXG4gICAgICAgIGlmKGxldmVscy5sZW5ndGgpIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiBsZXZlbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsIDogdXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogc3RhdHN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6dHJ1ZSwgdXJsIDogdXJsLCByZWFzb24gOiAnbm8gbGV2ZWwgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwgeyB0eXBlIDogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOnRydWUsIHVybCA6IHVybCwgcmVhc29uIDogJ25vIEVYVE0zVSBkZWxpbWl0ZXInfSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgdmFyIGRldGFpbHMsZmF0YWw7XG4gICAgaWYodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I7XG4gICAgICBmYXRhbCA9IGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOmRldGFpbHMsIGZhdGFsOmZhdGFsLCB1cmw6dGhpcy51cmwsIGxvYWRlciA6IHRoaXMubG9hZGVyLCByZXNwb25zZTpldmVudC5jdXJyZW50VGFyZ2V0LCBsZXZlbDogdGhpcy5pZCwgaWQgOiB0aGlzLmlkMn0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdmFyIGRldGFpbHMsZmF0YWw7XG4gICAgaWYodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX1RJTUVPVVQ7XG4gICAgICBmYXRhbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwgeyB0eXBlIDogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOmRldGFpbHMsIGZhdGFsOmZhdGFsLCB1cmwgOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgbGV2ZWw6IHRoaXMuaWQsIGlkIDogdGhpcy5pZDJ9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQbGF5bGlzdExvYWRlcjtcbiIsImltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcblxubGV0IG9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuXG5vYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xufTtcblxub2JzZXJ2ZXIub2ZmID0gZnVuY3Rpb24gb2ZmIChldmVudCwgLi4uZGF0YSkge1xuICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG59O1xuXG5cbmV4cG9ydCBkZWZhdWx0IG9ic2VydmVyO1xuIiwiLyoqXG4gKiBnZW5lcmF0ZSBNUDQgQm94XG4gKi9cblxuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW10sXG4gICAgICBzbWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBNUDQuTUFKT1JfQlJBTkQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAnaScuY2hhckNvZGVBdCgwKSxcbiAgICAgICdzJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ28nLmNoYXJDb2RlQXQoMCksXG4gICAgICAnbScuY2hhckNvZGVBdCgwKVxuICAgIF0pO1xuICAgIE1QNC5BVkMxX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2EnLmNoYXJDb2RlQXQoMCksXG4gICAgICAndicuY2hhckNvZGVBdCgwKSxcbiAgICAgICdjJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJzEnLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuTUlOT1JfVkVSU0lPTiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG4gICAgTVA0LlZJREVPX0hETFIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAweDZmLCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICAgIF0pO1xuICAgIE1QNC5BVURJT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzMsIDB4NmYsIDB4NzUsIDB4NmUsIC8vIGhhbmRsZXJfdHlwZTogJ3NvdW4nXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDUzLCAweDZmLCAweDc1LCAweDZlLFxuICAgICAgMHg2NCwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1NvdW5kSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuSERMUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6TVA0LlZJREVPX0hETFIsXG4gICAgICAnYXVkaW8nOk1QNC5BVURJT19IRExSXG4gICAgfTtcbiAgICBNUDQuRFJFRiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGVudHJ5X2NvdW50XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDBjLCAvLyBlbnRyeV9zaXplXG4gICAgICAweDc1LCAweDcyLCAweDZjLCAweDIwLCAvLyAndXJsJyB0eXBlXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEgLy8gZW50cnlfZmxhZ3NcbiAgICBdKTtcbiAgICBNUDQuU1RDTyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwIC8vIGVudHJ5X2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlNUU0MgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RUUyA9IE1QNC5TVENPO1xuICAgIE1QNC5TVFNaID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfY291bnRcbiAgICBdKTtcbiAgICBNUDQuVk1IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBncmFwaGljc21vZGVcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCAvLyBvcGNvbG9yXG4gICAgXSk7XG4gICAgTVA0LlNNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gYmFsYW5jZVxuICAgICAgMHgwMCwgMHgwMCAvLyByZXNlcnZlZFxuICAgIF0pO1xuXG4gICAgTVA0LlNUU0QgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxXSk7Ly8gZW50cnlfY291bnRcblxuICAgIE1QNC5GVFlQID0gTVA0LmJveChNUDQudHlwZXMuZnR5cCwgTVA0Lk1BSk9SX0JSQU5ELCBNUDQuTUlOT1JfVkVSU0lPTiwgTVA0Lk1BSk9SX0JSQU5ELCBNUDQuQVZDMV9CUkFORCk7XG4gICAgTVA0LkRJTkYgPSBNUDQuYm94KE1QNC50eXBlcy5kaW5mLCBNUDQuYm94KE1QNC50eXBlcy5kcmVmLCBNUDQuRFJFRikpO1xuICB9XG5cbiAgc3RhdGljIGJveCh0eXBlKSB7XG4gIHZhclxuICAgIHBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuICAgIHNpemUgPSAwLFxuICAgIGkgPSBwYXlsb2FkLmxlbmd0aCxcbiAgICByZXN1bHQsXG4gICAgdmlldztcblxuICAgIC8vIGNhbGN1bGF0ZSB0aGUgdG90YWwgc2l6ZSB3ZSBuZWVkIHRvIGFsbG9jYXRlXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KHNpemUgKyA4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KHJlc3VsdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIHJlc3VsdC5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KHR5cGUsIDQpO1xuXG4gICAgLy8gY29weSB0aGUgcGF5bG9hZCBpbnRvIHRoZSByZXN1bHRcbiAgICBmb3IgKGkgPSAwLCBzaXplID0gODsgaSA8IHBheWxvYWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdC5zZXQocGF5bG9hZFtpXSwgc2l6ZSk7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHN0YXRpYyBoZGxyKHR5cGUpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuaGRsciwgTVA0LkhETFJfVFlQRVNbdHlwZV0pO1xuICB9XG5cbiAgc3RhdGljIG1kYXQoZGF0YSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGF0LCBkYXRhKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGhkKHRpbWVzY2FsZSxkdXJhdGlvbikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAzLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAxNikgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAoZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4NTUsIDB4YzQsIC8vICd1bmQnIGxhbmd1YWdlICh1bmRldGVybWluZWQpXG4gICAgICAweDAwLCAweDAwXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1kaWEodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRpYSwgTVA0Lm1kaGQodHJhY2sudGltZXNjYWxlLHRyYWNrLmR1cmF0aW9uKSwgTVA0LmhkbHIodHJhY2sudHlwZSksIE1QNC5taW5mKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbWZoZChzZXF1ZW5jZU51bWJlcikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAyNCksXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMTYpICYgMHhGRixcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAgOCkgJiAweEZGLFxuICAgICAgc2VxdWVuY2VOdW1iZXIgJiAweEZGLCAvLyBzZXF1ZW5jZV9udW1iZXJcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWluZih0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMuc21oZCwgTVA0LlNNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5WTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsXG4gICAgICAgICAgICAgICAgICAgTVA0Lm1maGQoc24pLFxuICAgICAgICAgICAgICAgICAgIE1QNC50cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpKTtcbiAgfVxuLyoqXG4gKiBAcGFyYW0gdHJhY2tzLi4uIChvcHRpb25hbCkge2FycmF5fSB0aGUgdHJhY2tzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vdmllXG4gKi9cbiAgc3RhdGljIG1vb3YodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmFrKHRyYWNrc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tb292LCBNUDQubXZoZCh0cmFja3NbMF0udGltZXNjYWxlLHRyYWNrc1swXS5kdXJhdGlvbildLmNvbmNhdChib3hlcykuY29uY2F0KE1QNC5tdmV4KHRyYWNrcykpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmV4KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJleCh0cmFja3NbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm12ZXhdLmNvbmNhdChib3hlcykpO1xuICB9XG5cbiAgc3RhdGljIG12aGQodGltZXNjYWxlLGR1cmF0aW9uKSB7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgLy8gMS4wIHJhdGVcbiAgICAgICAgMHgwMSwgMHgwMCwgLy8gMS4wIHZvbHVtZVxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgICAgXSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm12aGQsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzZHRwKHRyYWNrKSB7XG4gICAgdmFyXG4gICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCArIHNhbXBsZXMubGVuZ3RoKSxcbiAgICAgIGZsYWdzLFxuICAgICAgaTtcblxuICAgIC8vIGxlYXZlIHRoZSBmdWxsIGJveCBoZWFkZXIgKDQgYnl0ZXMpIGFsbCB6ZXJvXG5cbiAgICAvLyB3cml0ZSB0aGUgc2FtcGxlIHRhYmxlXG4gICAgZm9yIChpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZsYWdzID0gc2FtcGxlc1tpXS5mbGFncztcbiAgICAgIGJ5dGVzW2kgKyA0XSA9IChmbGFncy5kZXBlbmRzT24gPDwgNCkgfFxuICAgICAgICAoZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDIpIHxcbiAgICAgICAgKGZsYWdzLmhhc1JlZHVuZGFuY3kpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zZHRwLFxuICAgICAgICAgICAgICAgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHN0YmwodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RibCxcbiAgICAgICAgICAgICAgIE1QNC5zdHNkKHRyYWNrKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0dHMsIE1QNC5TVFRTKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0c2MsIE1QNC5TVFNDKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0c3osIE1QNC5TVFNaKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0Y28sIE1QNC5TVENPKSk7XG4gIH1cblxuICBzdGF0aWMgYXZjMSh0cmFjaykge1xuICAgIHZhciBzcHMgPSBbXSwgcHBzID0gW10sIGk7XG4gICAgLy8gYXNzZW1ibGUgdGhlIFNQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2suc3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzcHMucHVzaCgodHJhY2suc3BzW2ldLmJ5dGVMZW5ndGggPj4+IDgpICYgMHhGRik7XG4gICAgICBzcHMucHVzaCgodHJhY2suc3BzW2ldLmJ5dGVMZW5ndGggJiAweEZGKSk7IC8vIHNlcXVlbmNlUGFyYW1ldGVyU2V0TGVuZ3RoXG4gICAgICBzcHMgPSBzcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRyYWNrLnNwc1tpXSkpOyAvLyBTUFNcbiAgICB9XG5cbiAgICAvLyBhc3NlbWJsZSB0aGUgUFBTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5wcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHBwcy5wdXNoKCh0cmFjay5wcHNbaV0uYnl0ZUxlbmd0aCA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHBwcy5wdXNoKCh0cmFjay5wcHNbaV0uYnl0ZUxlbmd0aCAmIDB4RkYpKTtcbiAgICAgIHBwcyA9IHBwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodHJhY2sucHBzW2ldKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmF2YzEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgKHRyYWNrLndpZHRoID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2sud2lkdGggJiAweGZmLCAvLyB3aWR0aFxuICAgICAgICAodHJhY2suaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2suaGVpZ2h0ICYgMHhmZiwgLy8gaGVpZ2h0XG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIGhvcml6cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyB2ZXJ0cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBmcmFtZV9jb3VudFxuICAgICAgICAweDEzLFxuICAgICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgICAweDZmLCAweDZhLCAweDczLCAweDJkLFxuICAgICAgICAweDYzLCAweDZmLCAweDZlLCAweDc0LFxuICAgICAgICAweDcyLCAweDY5LCAweDYyLCAweDJkLFxuICAgICAgICAweDY4LCAweDZjLCAweDczLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBjb21wcmVzc29ybmFtZVxuICAgICAgICAweDAwLCAweDE4LCAvLyBkZXB0aCA9IDI0XG4gICAgICAgIDB4MTEsIDB4MTFdKSwgLy8gcHJlX2RlZmluZWQgPSAtMVxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmF2Y0MsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDEsIC8vIGNvbmZpZ3VyYXRpb25WZXJzaW9uXG4gICAgICAgICAgICB0cmFjay5wcm9maWxlSWRjLCAvLyBBVkNQcm9maWxlSW5kaWNhdGlvblxuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUNvbXBhdCwgLy8gcHJvZmlsZV9jb21wYXRpYmlsaXR5XG4gICAgICAgICAgICB0cmFjay5sZXZlbElkYywgLy8gQVZDTGV2ZWxJbmRpY2F0aW9uXG4gICAgICAgICAgICAweGZmIC8vIGxlbmd0aFNpemVNaW51c09uZSwgaGFyZC1jb2RlZCB0byA0IGJ5dGVzXG4gICAgICAgICAgXS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2suc3BzLmxlbmd0aCAvLyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChzcHMpLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5wcHMubGVuZ3RoIC8vIG51bU9mUGljdHVyZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQocHBzKSkpLCAvLyBcIlBQU1wiXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrdHJhY2suY29uZmlnLmxlbmd0aCwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK3RyYWNrLmNvbmZpZy5sZW5ndGgsIC8vIGxlbmd0aFxuICAgICAgMHg0MCwgLy9jb2RlYyA6IG1wZWc0X2F1ZGlvXG4gICAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYnVmZmVyX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1heEJpdHJhdGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgICAgMHgwNSAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIF0uY29uY2F0KFt0cmFjay5jb25maWcubGVuZ3RoXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgICAgKHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQubXA0YSh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQuYXZjMSh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB0a2hkKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRraGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwNywgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodHJhY2suaWQgPj4gMjQpICYgMHhGRixcbiAgICAgICh0cmFjay5pZCA+PiAxNikgJiAweEZGLFxuICAgICAgKHRyYWNrLmlkID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmlkICYgMHhGRiwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbGF5ZXJcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGFsdGVybmF0ZV9ncm91cFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbm9uLWF1ZGlvIHRyYWNrIHZvbHVtZVxuICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgKHRyYWNrLndpZHRoID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLndpZHRoICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHdpZHRoXG4gICAgICAodHJhY2suaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmhlaWdodCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwIC8vIGhlaWdodFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpIHtcbiAgICB2YXIgc2FtcGxlRGVwZW5kZW5jeVRhYmxlID0gTVA0LnNkdHAodHJhY2spO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFmLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDI0KSxcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYpIC8vIHRyYWNrX0lEXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmR0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PjI0KSxcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYpIC8vIGJhc2VNZWRpYURlY29kZVRpbWVcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC50cnVuKHRyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmhkXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZkdFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIHRyYWYgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gbWZoZFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIG1vb2YgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDgpLCAgLy8gbWRhdCBoZWFkZXJcbiAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZSk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSB0cmFjayBib3guXG4gICAqIEBwYXJhbSB0cmFjayB7b2JqZWN0fSBhIHRyYWNrIGRlZmluaXRpb25cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIHRyYWNrIGJveFxuICAgKi9cbiAgc3RhdGljIHRyYWsodHJhY2spIHtcbiAgICB0cmFjay5kdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uIHx8IDB4ZmZmZmZmZmY7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWssXG4gICAgICAgICAgICAgICBNUDQudGtoZCh0cmFjayksXG4gICAgICAgICAgICAgICBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAodHJhY2suaWQgPj4gMjQpLFxuICAgICAodHJhY2suaWQgPj4gMTYpICYgMFhGRixcbiAgICAgKHRyYWNrLmlkID4+IDgpICYgMFhGRixcbiAgICAgKHRyYWNrLmlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIHNhbXBsZXMsIHNhbXBsZSwgaSwgYXJyYXk7XG5cbiAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXTtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KDEyICsgKDE2ICogc2FtcGxlcy5sZW5ndGgpKTtcbiAgICBvZmZzZXQgKz0gOCArIGFycmF5LmJ5dGVMZW5ndGg7XG5cbiAgICBhcnJheS5zZXQoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDBmLCAweDAxLCAvLyBmbGFnc1xuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiAyNCkgJiAweEZGLFxuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiAxNikgJiAweEZGLFxuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiA4KSAmIDB4RkYsXG4gICAgICBzYW1wbGVzLmxlbmd0aCAmIDB4RkYsIC8vIHNhbXBsZV9jb3VudFxuICAgICAgKG9mZnNldCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiA4KSAmIDB4RkYsXG4gICAgICBvZmZzZXQgJiAweEZGIC8vIGRhdGFfb2Zmc2V0XG4gICAgXSwwKTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzYW1wbGUgPSBzYW1wbGVzW2ldO1xuICAgICAgYXJyYXkuc2V0KFtcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuZHVyYXRpb24gJiAweEZGLCAvLyBzYW1wbGVfZHVyYXRpb25cbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuc2l6ZSAmIDB4RkYsIC8vIHNhbXBsZV9zaXplXG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgc2FtcGxlLmZsYWdzLmRlcGVuZHNPbixcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAgIChzYW1wbGUuZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKHNhbXBsZS5mbGFncy5wYWRkaW5nVmFsdWUgPDwgMSkgfFxuICAgICAgICAgIHNhbXBsZS5mbGFncy5pc05vblN5bmMsXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRQcmlvICYgMHhGMCA8PCA4LFxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkUHJpbyAmIDB4MEYsIC8vIHNhbXBsZV9mbGFnc1xuICAgICAgICAoc2FtcGxlLmN0cyA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5jdHMgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuY3RzID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5jdHMgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgICAgXSwxMisxNippKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRydW4sIGFycmF5KTtcbiAgfVxuXG4gIHN0YXRpYyBpbml0U2VnbWVudCh0cmFja3MpIHtcblxuICAgIGlmKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhclxuICAgICAgbW92aWUgPSBNUDQubW9vdih0cmFja3MpLFxuICAgICAgcmVzdWx0O1xuXG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoTVA0LkZUWVAuYnl0ZUxlbmd0aCArIG1vdmllLmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQoTVA0LkZUWVApO1xuICAgIHJlc3VsdC5zZXQobW92aWUsIE1QNC5GVFlQLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuXG5cbiIsIiAvKlxuICogU3RhdHMgSGFuZGxlclxuICpcbiAqL1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi9ldmVudHMnO1xuaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4vb2JzZXJ2ZXInO1xuXG4gY2xhc3MgU3RhdHNIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscz1obHM7XG4gICAgdGhpcy5vbm1wID0gdGhpcy5vbk1hbmlmZXN0UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZjID0gdGhpcy5vbkZyYWdtZW50Q2hhbmdlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mYiA9IHRoaXMub25GcmFnbWVudEJ1ZmZlcmVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsZWEgPSB0aGlzLm9uRnJhZ21lbnRMb2FkRW1lcmdlbmN5QWJvcnRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25lcnIgPSB0aGlzLm9uRXJyb3IuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZnBzZCA9IHRoaXMub25GUFNEcm9wLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHRoaXMub25mYik7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19DSEFOR0VELCB0aGlzLm9uZmMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQsIHRoaXMub25mbGVhKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUFNfRFJPUCwgdGhpcy5vbmZwc2QpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX0JVRkZFUkVELCB0aGlzLm9uZmIpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX0NIQU5HRUQsIHRoaXMub25mYyk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB0aGlzLm9uZmxlYSk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZQU19EUk9QLCB0aGlzLm9uZnBzZCk7XG4gIH1cblxuICBhdHRhY2hWaWRlbyh2aWRlbykge1xuICAgIHRoaXMudmlkZW8gPSB2aWRlbztcbiAgfVxuXG4gIGRldGFjaFZpZGVvKCkge1xuICAgIHRoaXMudmlkZW8gPSBudWxsO1xuICB9XG5cbiAgLy8gcmVzZXQgc3RhdHMgb24gbWFuaWZlc3QgcGFyc2VkXG4gIG9uTWFuaWZlc3RQYXJzZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMuX3N0YXRzID0geyB0ZWNoIDogJ2hscy5qcycsIGxldmVsTmIgOiBkYXRhLmxldmVscy5sZW5ndGh9O1xuICB9XG5cbiAgLy8gb24gZnJhZ21lbnQgY2hhbmdlZCBpcyB0cmlnZ2VyZWQgd2hlbmV2ZXIgcGxheWJhY2sgb2YgYSBuZXcgZnJhZ21lbnQgaXMgc3RhcnRpbmcgLi4uXG4gIG9uRnJhZ21lbnRDaGFuZ2VkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLl9zdGF0cyxsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbCxhdXRvTGV2ZWwgPSBkYXRhLmZyYWcuYXV0b0xldmVsO1xuICAgIGlmKHN0YXRzKSB7XG4gICAgICBpZihzdGF0cy5sZXZlbFN0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RhdHMubGV2ZWxTdGFydCA9IGxldmVsO1xuICAgICAgfVxuICAgICAgaWYoYXV0b0xldmVsKSB7XG4gICAgICAgIGlmKHN0YXRzLmZyYWdDaGFuZ2VkQXV0bykge1xuICAgICAgICAgIHN0YXRzLmF1dG9MZXZlbE1pbiA9IE1hdGgubWluKHN0YXRzLmF1dG9MZXZlbE1pbixsZXZlbCk7XG4gICAgICAgICAgc3RhdHMuYXV0b0xldmVsTWF4ID0gTWF0aC5tYXgoc3RhdHMuYXV0b0xldmVsTWF4LGxldmVsKTtcbiAgICAgICAgICBzdGF0cy5mcmFnQ2hhbmdlZEF1dG8rKztcbiAgICAgICAgICBpZih0aGlzLmxldmVsTGFzdEF1dG8gJiYgbGV2ZWwgIT09IHN0YXRzLmF1dG9MZXZlbExhc3QpIHtcbiAgICAgICAgICAgIHN0YXRzLmF1dG9MZXZlbFN3aXRjaCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdGF0cy5hdXRvTGV2ZWxNaW4gPSBzdGF0cy5hdXRvTGV2ZWxNYXggPSBsZXZlbDtcbiAgICAgICAgICBzdGF0cy5hdXRvTGV2ZWxTd2l0Y2ggPSAwO1xuICAgICAgICAgIHN0YXRzLmZyYWdDaGFuZ2VkQXV0byA9IDE7XG4gICAgICAgICAgdGhpcy5zdW1BdXRvTGV2ZWwgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3VtQXV0b0xldmVsKz1sZXZlbDtcbiAgICAgICAgc3RhdHMuYXV0b0xldmVsQXZnID0gTWF0aC5yb3VuZCgxMDAwKnRoaXMuc3VtQXV0b0xldmVsL3N0YXRzLmZyYWdDaGFuZ2VkQXV0bykvMTAwMDtcbiAgICAgICAgc3RhdHMuYXV0b0xldmVsTGFzdCA9IGxldmVsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYoc3RhdHMuZnJhZ0NoYW5nZWRNYW51YWwpIHtcbiAgICAgICAgICBzdGF0cy5tYW51YWxMZXZlbE1pbiA9IE1hdGgubWluKHN0YXRzLm1hbnVhbExldmVsTWluLGxldmVsKTtcbiAgICAgICAgICBzdGF0cy5tYW51YWxMZXZlbE1heCA9IE1hdGgubWF4KHN0YXRzLm1hbnVhbExldmVsTWF4LGxldmVsKTtcbiAgICAgICAgICBzdGF0cy5mcmFnQ2hhbmdlZE1hbnVhbCsrO1xuICAgICAgICAgIGlmKCF0aGlzLmxldmVsTGFzdEF1dG8gJiYgbGV2ZWwgIT09IHN0YXRzLm1hbnVhbExldmVsTGFzdCkge1xuICAgICAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxTd2l0Y2grKztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxNaW4gPSBzdGF0cy5tYW51YWxMZXZlbE1heCA9IGxldmVsO1xuICAgICAgICAgIHN0YXRzLm1hbnVhbExldmVsU3dpdGNoID0gMDtcbiAgICAgICAgICBzdGF0cy5mcmFnQ2hhbmdlZE1hbnVhbCA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxMYXN0ID0gbGV2ZWw7XG4gICAgICB9XG4gICAgICB0aGlzLmxldmVsTGFzdEF1dG8gPSBhdXRvTGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgLy8gdHJpZ2dlcmVkIGVhY2ggdGltZSBhIG5ldyBmcmFnbWVudCBpcyBidWZmZXJlZFxuICBvbkZyYWdtZW50QnVmZmVyZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBzdGF0cyA9IHRoaXMuX3N0YXRzLGxhdGVuY3kgPSBkYXRhLnN0YXRzLnRmaXJzdCAtIGRhdGEuc3RhdHMudHJlcXVlc3QsIHByb2Nlc3MgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCAtIGRhdGEuc3RhdHMudHJlcXVlc3QsIGJpdHJhdGUgPSBNYXRoLnJvdW5kKDgqZGF0YS5zdGF0cy5sZW5ndGgvKGRhdGEuc3RhdHMudGJ1ZmZlcmVkIC0gZGF0YS5zdGF0cy50Zmlyc3QpKTtcbiAgICBpZihzdGF0cy5mcmFnQnVmZmVyZWQpIHtcbiAgICAgIHN0YXRzLmZyYWdNaW5MYXRlbmN5ID0gTWF0aC5taW4oc3RhdHMuZnJhZ01pbkxhdGVuY3ksbGF0ZW5jeSk7XG4gICAgICBzdGF0cy5mcmFnTWF4TGF0ZW5jeSA9IE1hdGgubWF4KHN0YXRzLmZyYWdNYXhMYXRlbmN5LGxhdGVuY3kpO1xuICAgICAgc3RhdHMuZnJhZ01pblByb2Nlc3MgPSBNYXRoLm1pbihzdGF0cy5mcmFnTWluUHJvY2Vzcyxwcm9jZXNzKTtcbiAgICAgIHN0YXRzLmZyYWdNYXhQcm9jZXNzID0gTWF0aC5tYXgoc3RhdHMuZnJhZ01heFByb2Nlc3MscHJvY2Vzcyk7XG4gICAgICBzdGF0cy5mcmFnTWluS2JwcyA9IE1hdGgubWluKHN0YXRzLmZyYWdNaW5LYnBzLGJpdHJhdGUpO1xuICAgICAgc3RhdHMuZnJhZ01heEticHMgPSBNYXRoLm1heChzdGF0cy5mcmFnTWF4S2JwcyxiaXRyYXRlKTtcbiAgICAgIHN0YXRzLmF1dG9MZXZlbENhcHBpbmdNaW4gPSBNYXRoLm1pbihzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWluLHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmcpO1xuICAgICAgc3RhdHMuYXV0b0xldmVsQ2FwcGluZ01heCA9IE1hdGgubWF4KHN0YXRzLmF1dG9MZXZlbENhcHBpbmdNYXgsdGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZyk7XG4gICAgICBzdGF0cy5mcmFnQnVmZmVyZWQrKztcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHMuZnJhZ01pbkxhdGVuY3kgPSBzdGF0cy5mcmFnTWF4TGF0ZW5jeSA9IGxhdGVuY3k7XG4gICAgICBzdGF0cy5mcmFnTWluUHJvY2VzcyA9IHN0YXRzLmZyYWdNYXhQcm9jZXNzID0gcHJvY2VzcztcbiAgICAgIHN0YXRzLmZyYWdNaW5LYnBzID0gc3RhdHMuZnJhZ01heEticHMgPSBiaXRyYXRlO1xuICAgICAgc3RhdHMuZnJhZ0J1ZmZlcmVkID0gMTtcbiAgICAgIHN0YXRzLmZyYWdCdWZmZXJlZEJ5dGVzID0gMDtcbiAgICAgIHN0YXRzLmF1dG9MZXZlbENhcHBpbmdNaW4gPSBzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWF4ID0gdGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZztcbiAgICAgIHRoaXMuc3VtTGF0ZW5jeT0wO1xuICAgICAgdGhpcy5zdW1LYnBzPTA7XG4gICAgICB0aGlzLnN1bVByb2Nlc3M9MDtcbiAgICB9XG4gICAgc3RhdHMuZnJhZ2xhc3RMYXRlbmN5PWxhdGVuY3k7XG4gICAgdGhpcy5zdW1MYXRlbmN5Kz1sYXRlbmN5O1xuICAgIHN0YXRzLmZyYWdBdmdMYXRlbmN5ID0gTWF0aC5yb3VuZCh0aGlzLnN1bUxhdGVuY3kvc3RhdHMuZnJhZ0J1ZmZlcmVkKTtcbiAgICBzdGF0cy5mcmFnTGFzdFByb2Nlc3M9cHJvY2VzcztcbiAgICB0aGlzLnN1bVByb2Nlc3MrPXByb2Nlc3M7XG4gICAgc3RhdHMuZnJhZ0F2Z1Byb2Nlc3MgPSBNYXRoLnJvdW5kKHRoaXMuc3VtUHJvY2Vzcy9zdGF0cy5mcmFnQnVmZmVyZWQpO1xuICAgIHN0YXRzLmZyYWdMYXN0S2Jwcz1iaXRyYXRlO1xuICAgIHRoaXMuc3VtS2Jwcys9Yml0cmF0ZTtcbiAgICBzdGF0cy5mcmFnQXZnS2JwcyA9IE1hdGgucm91bmQodGhpcy5zdW1LYnBzL3N0YXRzLmZyYWdCdWZmZXJlZCk7XG4gICAgc3RhdHMuZnJhZ0J1ZmZlcmVkQnl0ZXMrPWRhdGEuc3RhdHMubGVuZ3RoO1xuICAgIHN0YXRzLmF1dG9MZXZlbENhcHBpbmdMYXN0ID0gdGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkRW1lcmdlbmN5QWJvcnRlZCgpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLl9zdGF0cztcbiAgICBpZihzdGF0cykge1xuICAgICAgaWYoc3RhdHMuZnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RhdHMuZnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkID0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdHMuZnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkKys7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihldmVudCxkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5fc3RhdHM7XG4gICAgaWYoc3RhdHMpIHtcbiAgICAgIC8vIHRyYWNrIGFsbCBlcnJvcnMgaW5kZXBlbmRlbnRseVxuICAgICAgaWYoc3RhdHNbZGF0YS5kZXRhaWxzXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHN0YXRzW2RhdGEuZGV0YWlsc10gPTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGF0c1tkYXRhLmRldGFpbHNdKz0xO1xuICAgICAgfVxuICAgICAgLy8gdHJhY2sgZmF0YWwgZXJyb3JcbiAgICAgIGlmKGRhdGEuZmF0YWwpIHtcbiAgICAgICAgaWYoc3RhdHMuZmF0YWxFcnJvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdGF0cy5mYXRhbEVycm9yPTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0cy5mYXRhbEVycm9yKz0xO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25GUFNEcm9wKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLl9zdGF0cztcbiAgICBpZihzdGF0cykge1xuICAgICBpZihzdGF0cy5mcHNEcm9wRXZlbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzdGF0cy5mcHNEcm9wRXZlbnQgPTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGF0cy5mcHNEcm9wRXZlbnQrKztcbiAgICAgIH1cbiAgICAgIHN0YXRzLmZwc1RvdGFsRHJvcHBlZEZyYW1lcyA9IGRhdGEudG90YWxEcm9wcGVkRnJhbWVzO1xuICAgIH1cbiAgfVxuXG4gIGdldCBzdGF0cygpIHtcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLl9zdGF0cy5sYXN0UG9zID0gdGhpcy52aWRlby5jdXJyZW50VGltZS50b0ZpeGVkKDMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3RhdHM7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU3RhdHNIYW5kbGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wKCl7fVxubGV0IGZha2VMb2dnZXIgPSB7XG4gIGxvZzogbm9vcCxcbiAgd2Fybjogbm9vcCxcbiAgaW5mbzogbm9vcCxcbiAgZXJyb3I6IG5vb3Bcbn07XG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Zykge1xuICBpZiAoZGVidWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnICAgICAgID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyAgID0gZGVidWcubG9nICAgPyBkZWJ1Zy5sb2cuYmluZChkZWJ1ZykgICA6IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBkZWJ1Zy5pbmZvICA/IGRlYnVnLmluZm8uYmluZChkZWJ1ZykgIDogY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBkZWJ1Zy5lcnJvciA/IGRlYnVnLmVycm9yLmJpbmQoZGVidWcpIDogY29uc29sZS5lcnJvci5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gID0gZGVidWcud2FybiAgPyBkZWJ1Zy53YXJuLmJpbmQoZGVidWcpICA6IGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpO1xuXG4gICAgLy8gU29tZSBicm93c2VycyBkb24ndCBhbGxvdyB0byB1c2UgYmluZCBvbiBjb25zb2xlIG9iamVjdCBhbnl3YXlcbiAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgIGV4cG9ydGVkTG9nZ2VyLmxvZygpO1xuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgZXhwb3J0ZWRMb2dnZXIubG9nICAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIud2FybiAgPSBub29wO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5leHBvcnQgdmFyIGxvZ2dlciA9IGV4cG9ydGVkTG9nZ2VyO1xuIiwiIC8qXG4gICogWGhyIGJhc2VkIExvYWRlclxuICAqXG4gICovXG5cbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4gY2xhc3MgWGhyTG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIGlmKHRoaXMubG9hZGVyICYmdGhpcy5sb2FkZXIucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgdGhpcy5zdGF0cy5hYm9ydGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIGlmKHRoaXMudGltZW91dEhhbmRsZSkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQodXJsLHJlc3BvbnNlVHlwZSxvblN1Y2Nlc3Msb25FcnJvcixvblRpbWVvdXQsdGltZW91dCxtYXhSZXRyeSxyZXRyeURlbGF5LG9uUHJvZ3Jlc3M9bnVsbCkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuICAgIHRoaXMub25TdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHRoaXMub25Qcm9ncmVzcyA9IG9uUHJvZ3Jlc3M7XG4gICAgdGhpcy5vblRpbWVvdXQgPSBvblRpbWVvdXQ7XG4gICAgdGhpcy5vbkVycm9yID0gb25FcnJvcjtcbiAgICB0aGlzLnN0YXRzID0geyB0cmVxdWVzdDpuZXcgRGF0ZSgpLCByZXRyeTowfTtcbiAgICB0aGlzLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgIHRoaXMubWF4UmV0cnkgPSBtYXhSZXRyeTtcbiAgICB0aGlzLnJldHJ5RGVsYXkgPSByZXRyeURlbGF5O1xuICAgIHRoaXMudGltZW91dEhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSx0aW1lb3V0KTtcbiAgICB0aGlzLmxvYWRJbnRlcm5hbCgpO1xuICB9XG5cbiAgbG9hZEludGVybmFsKCkge1xuICAgIHZhciB4aHIgPSB0aGlzLmxvYWRlciA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhoci5vbmxvYWQgPSAgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vbmVycm9yID0gdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIHRoaXMudXJsICwgdHJ1ZSk7XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9IHRoaXMucmVzcG9uc2VUeXBlO1xuICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnN0YXRzLmxvYWRlZCA9IDA7XG4gICAgeGhyLnNlbmQoKTtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgIHRoaXMuc3RhdHMudGxvYWQgPSBuZXcgRGF0ZSgpO1xuICAgIHRoaXMub25TdWNjZXNzKGV2ZW50LHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgaWYodGhpcy5zdGF0cy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgIGxvZ2dlci53YXJuKGAke2V2ZW50LnR5cGV9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICB3aW5kb3cuc2V0VGltZW91dCh0aGlzLmxvYWRJbnRlcm5hbC5iaW5kKHRoaXMpLHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmXG4gICAgICB0aGlzLnJldHJ5RGVsYXk9TWF0aC5taW4oMip0aGlzLnJldHJ5RGVsYXksNjQwMDApO1xuICAgICAgdGhpcy5zdGF0cy5yZXRyeSsrO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICBsb2dnZXIuZXJyb3IoYCR7ZXZlbnQudHlwZX0gd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfWAgKTtcbiAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgfVxuICB9XG5cbiAgbG9hZHRpbWVvdXQoZXZlbnQpIHtcbiAgICBsb2dnZXIud2FybihgdGltZW91dCB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgIHRoaXMub25UaW1lb3V0KGV2ZW50LHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZihzdGF0cy50Zmlyc3QgPT09IG51bGwpIHtcbiAgICAgIHN0YXRzLnRmaXJzdCA9IG5ldyBEYXRlKCk7XG4gICAgfVxuICAgIHN0YXRzLmxvYWRlZCA9IGV2ZW50LmxvYWRlZDtcbiAgICBpZih0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
