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
      avcSample = { units: units, pts: pes.pts, dts: pes.dts, key: key };
      this._avcSamples.push(avcSample);
      this._avcSamplesLength += units.length;
      this._avcSamplesNbNalu += units.units.length;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2Vycm9ycy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZXZlbnRzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9obHMuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9mcmFnbWVudC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL29ic2VydmVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9yZW11eC9tcDQtZ2VuZXJhdG9yLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9zdGF0cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvbG9nZ2VyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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RUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7T0FDdkIsQ0FBQyxDQUFDO0FBQ0wsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3ZDOzs7V0FFVSxjQUFDLEtBQUssRUFBRTtBQUNqQixVQUNFLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxJQUFJLEVBQUU7VUFDN0IsS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO1VBQzFDLEtBQUs7VUFDTCxDQUFDLENBQUM7Ozs7O0FBS0osV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ25DLGFBQUssR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3pCLGFBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQUFBQyxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsR0FDakMsS0FBSyxDQUFDLFlBQVksSUFBSSxDQUFDLEFBQUMsR0FDeEIsS0FBSyxDQUFDLGFBQWEsQUFBQyxDQUFDO09BQ3pCOztBQUVELGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFDbEIsS0FBSyxDQUFDLENBQUM7S0FDbkI7OztXQUVVLGNBQUMsS0FBSyxFQUFFO0FBQ2pCLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFDbEIsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFDZixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFDakMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQ2pDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUNqQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQy9DOzs7V0FFVSxjQUFDLEtBQUssRUFBRTtBQUNqQixVQUFJLEdBQUcsR0FBRyxFQUFFO1VBQUUsR0FBRyxHQUFHLEVBQUU7VUFBRSxDQUFDLENBQUM7O0FBRTFCLFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDckMsV0FBRyxDQUFDLElBQUksQ0FBQyxBQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxLQUFLLENBQUMsR0FBSSxJQUFJLENBQUMsQ0FBQztBQUNqRCxXQUFHLENBQUMsSUFBSSxDQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBRSxDQUFDO0FBQzNDLFdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztPQUM1RDs7O0FBR0QsV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNyQyxXQUFHLENBQUMsSUFBSSxDQUFDLEFBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxHQUFJLElBQUksQ0FBQyxDQUFDO0FBQ2pELFdBQUcsQ0FBQyxJQUFJLENBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFFLENBQUM7QUFDM0MsV0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQzVEOztBQUVELGFBQU8sR0FBRyxDQUFDLEdBQUcs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TyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO09BQzVELE1BQU07QUFDTCxlQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7T0FDNUQ7S0FDRjs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksVUFBVSxDQUFDLENBQzVDLElBQUk7QUFDSixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDaEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLEFBQUMsV0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN2QixBQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFJLElBQUksRUFDdkIsQUFBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBSSxJQUFJLEVBQ3RCLEtBQUssQ0FBQyxFQUFFLEdBQUcsSUFBSTtBQUNmLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDckIsV0FBSyxDQUFDLFFBQVEsSUFBSSxFQUFFLEVBQ3JCLEFBQUMsS0FBSyxDQUFDLFFBQVEsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUM3QixBQUFDLEtBQUssQ0FBQyxRQUFRLElBQUssQ0FBQyxHQUFJLElBQUksRUFDN0IsS0FBSyxDQUFDLFFBQVEsR0FBRyxJQUFJO0FBQ3JCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUks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TyxLQUFLLENBQUksS0FBSyxDQUFDLElBQUksdUJBQWtCLElBQUksQ0FBQyxHQUFHLENBQUksQ0FBQztBQUN6RCxZQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO09BQ3JCO0tBQ0Y7OztXQUVVLHFCQUFDLEtBQUssRUFBRTtBQUNqQiwwQkFBTyxJQUFJLDRCQUEwQixJQUFJLENBQUMsR0FBRyxDQUFJLENBQUM7QUFDbEQsVUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2xDOzs7V0FFVyxzQkFBQyxLQUFLLEVBQUU7QUFDbEIsVUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUN2QixVQUFHLEtBQUssQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO0FBQ3hCLGFBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztPQUMzQjtBQUNELFdBQUssQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUM1QixVQUFHLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDbEIsWUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7T0FDL0I7S0FDRjs7O1NBbEZJLFNBQVM7OztxQkFxRkQsU0FBUyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgYnVuZGxlRm4gPSBhcmd1bWVudHNbM107XG52YXIgc291cmNlcyA9IGFyZ3VtZW50c1s0XTtcbnZhciBjYWNoZSA9IGFyZ3VtZW50c1s1XTtcblxudmFyIHN0cmluZ2lmeSA9IEpTT04uc3RyaW5naWZ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIHdrZXk7XG4gICAgdmFyIGNhY2hlS2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlKTtcbiAgICBcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgaWYgKGNhY2hlW2tleV0uZXhwb3J0cyA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoIXdrZXkpIHtcbiAgICAgICAgd2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgICAgICB2YXIgd2NhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgICAgIHdjYWNoZVtrZXldID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZXNbd2tleV0gPSBbXG4gICAgICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnLCdtb2R1bGUnLCdleHBvcnRzJ10sICcoJyArIGZuICsgJykoc2VsZiknKSxcbiAgICAgICAgICAgIHdjYWNoZVxuICAgICAgICBdO1xuICAgIH1cbiAgICB2YXIgc2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgIFxuICAgIHZhciBzY2FjaGUgPSB7fTsgc2NhY2hlW3drZXldID0gd2tleTtcbiAgICBzb3VyY2VzW3NrZXldID0gW1xuICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnXSwncmVxdWlyZSgnICsgc3RyaW5naWZ5KHdrZXkpICsgJykoc2VsZiknKSxcbiAgICAgICAgc2NhY2hlXG4gICAgXTtcbiAgICBcbiAgICB2YXIgc3JjID0gJygnICsgYnVuZGxlRm4gKyAnKSh7J1xuICAgICAgICArIE9iamVjdC5rZXlzKHNvdXJjZXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5naWZ5KGtleSkgKyAnOlsnXG4gICAgICAgICAgICAgICAgKyBzb3VyY2VzW2tleV1bMF1cbiAgICAgICAgICAgICAgICArICcsJyArIHN0cmluZ2lmeShzb3VyY2VzW2tleV1bMV0pICsgJ10nXG4gICAgICAgICAgICA7XG4gICAgICAgIH0pLmpvaW4oJywnKVxuICAgICAgICArICd9LHt9LFsnICsgc3RyaW5naWZ5KHNrZXkpICsgJ10pJ1xuICAgIDtcbiAgICBcbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuICAgIFxuICAgIHJldHVybiBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoXG4gICAgICAgIG5ldyBCbG9iKFtzcmNdLCB7IHR5cGU6ICd0ZXh0L2phdmFzY3JpcHQnIH0pXG4gICAgKSk7XG59O1xuIiwiLypcbiAqIGJ1ZmZlciBjb250cm9sbGVyXG4gKlxuICovXG5cbiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCBEZW11eGVyICAgICAgICAgICAgICBmcm9tICcuLi9kZW11eC9kZW11eGVyJztcbiBpbXBvcnQge0Vycm9yVHlwZXMsRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgQnVmZmVyQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5FUlJPUiA9IC0yO1xuICAgIHRoaXMuU1RBUlRJTkcgPSAtMTtcbiAgICB0aGlzLklETEUgPSAwO1xuICAgIHRoaXMuTE9BRElORyA9ICAxO1xuICAgIHRoaXMuV0FJVElOR19MRVZFTCA9IDI7XG4gICAgdGhpcy5QQVJTSU5HID0gMztcbiAgICB0aGlzLlBBUlNFRCA9IDQ7XG4gICAgdGhpcy5BUFBFTkRJTkcgPSA1O1xuICAgIHRoaXMuQlVGRkVSX0ZMVVNISU5HID0gNjtcbiAgICB0aGlzLmNvbmZpZyA9IGhscy5jb25maWc7XG4gICAgdGhpcy5zdGFydFBvc2l0aW9uID0gMDtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25zYmUgID0gdGhpcy5vblNvdXJjZUJ1ZmZlckVycm9yLmJpbmQodGhpcyk7XG4gICAgLy8gaW50ZXJuYWwgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NU0VBdHRhY2hlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2VkID0gdGhpcy5vbk1TRURldGFjaGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1wID0gdGhpcy5vbk1hbmlmZXN0UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdtZW50TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmlzID0gdGhpcy5vbkluaXRTZWdtZW50LmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwZyA9IHRoaXMub25GcmFnbWVudFBhcnNpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZnAgPSB0aGlzLm9uRnJhZ21lbnRQYXJzZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZXJyID0gdGhpcy5vbkVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NU0VfQVRUQUNIRUQsIHRoaXMub25tc2UpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1TRV9ERVRBQ0hFRCwgdGhpcy5vbm1zZWQpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgfVxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHRoaXMub25tcCk7XG4gICAgLy8gcmVtb3ZlIHZpZGVvIGxpc3RlbmVyXG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVraW5nJyx0aGlzLm9udnNlZWtpbmcpO1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVrZWQnLHRoaXMub252c2Vla2VkKTtcbiAgICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLHRoaXMub252bWV0YWRhdGEpO1xuICAgICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9udm1ldGFkYXRhID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgfVxuXG4gIHN0YXJ0TG9hZCgpIHtcbiAgICBpZih0aGlzLmxldmVscyAmJiB0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnN0YXJ0SW50ZXJuYWwoKTtcbiAgICAgIGlmKHRoaXMubGFzdEN1cnJlbnRUaW1lKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYHJlc3VtaW5nIHZpZGVvIEAgJHt0aGlzLmxhc3RDdXJyZW50VGltZX1gKTtcbiAgICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLlNUQVJUSU5HO1xuICAgICAgfVxuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKGBjYW5ub3Qgc3RhcnQgbG9hZGluZyBhcyBlaXRoZXIgbWFuaWZlc3Qgbm90IHBhcnNlZCBvciB2aWRlbyBub3QgYXR0YWNoZWRgKTtcbiAgICB9XG4gIH1cblxuICBzdGFydEludGVybmFsKCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVyKHRoaXMuY29uZmlnKTtcbiAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMCk7XG4gICAgdGhpcy5sZXZlbCA9IC0xO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gIH1cblxuXG4gIHN0b3AoKSB7XG4gICAgdGhpcy5tcDRzZWdtZW50cyA9IFtdO1xuICAgIHRoaXMuZmx1c2hSYW5nZSA9IFtdO1xuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBbXTtcbiAgICBpZih0aGlzLmZyYWcpIHtcbiAgICAgIGlmKHRoaXMuZnJhZy5sb2FkZXIpIHtcbiAgICAgICAgdGhpcy5mcmFnLmxvYWRlci5hYm9ydCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvcih2YXIgdHlwZSBpbiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICB2YXIgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZVNvdXJjZUJ1ZmZlcihzYik7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG5cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMuZGVtdXhlcikge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB0aGlzLm9uZnBnKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHZhciBwb3MsbGV2ZWwsbGV2ZWxEZXRhaWxzLGZyYWdJZHg7XG4gICAgc3dpdGNoKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgdGhpcy5FUlJPUjpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBlcnJvciBzdGF0ZSB0byBhdm9pZCBicmVha2luZyBmdXJ0aGVyIC4uLlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5TVEFSVElORzpcbiAgICAgICAgLy8gZGV0ZXJtaW5lIGxvYWQgbGV2ZWxcbiAgICAgICAgdGhpcy5zdGFydExldmVsID0gdGhpcy5obHMuc3RhcnRMZXZlbDtcbiAgICAgICAgaWYgKHRoaXMuc3RhcnRMZXZlbCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyAtMSA6IGd1ZXNzIHN0YXJ0IExldmVsIGJ5IGRvaW5nIGEgYml0cmF0ZSB0ZXN0IGJ5IGxvYWRpbmcgZmlyc3QgZnJhZ21lbnQgb2YgbG93ZXN0IHF1YWxpdHkgbGV2ZWxcbiAgICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSAwO1xuICAgICAgICAgIHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IG5ldyBsZXZlbCB0byBwbGF5bGlzdCBsb2FkZXIgOiB0aGlzIHdpbGwgdHJpZ2dlciBzdGFydCBsZXZlbCBsb2FkXG4gICAgICAgIHRoaXMubGV2ZWwgPSB0aGlzLmhscy5uZXh0TG9hZExldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5XQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSB0aGlzLklETEU6XG4gICAgICAgIC8vIGhhbmRsZSBlbmQgb2YgaW1tZWRpYXRlIHN3aXRjaGluZyBpZiBuZWVkZWRcbiAgICAgICAgaWYodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgICAgICB0aGlzLmltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB2aWRlbyBkZXRhY2hlZCBvciB1bmJvdW5kIGV4aXQgbG9vcFxuICAgICAgICBpZighdGhpcy52aWRlbykge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2VlayBiYWNrIHRvIGEgZXhwZWN0ZWQgcG9zaXRpb24gYWZ0ZXIgdmlkZW8gc3RhbGxpbmdcbiAgICAgICAgaWYodGhpcy5zZWVrQWZ0ZXJTdGFsbGluZykge1xuICAgICAgICAgIHRoaXMudmlkZW8uY3VycmVudFRpbWU9dGhpcy5zZWVrQWZ0ZXJTdGFsbGluZztcbiAgICAgICAgICB0aGlzLnNlZWtBZnRlclN0YWxsaW5nID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgY2FuZGlkYXRlIGZyYWdtZW50IHRvIGJlIGxvYWRlZCwgYmFzZWQgb24gY3VycmVudCBwb3NpdGlvbiBhbmRcbiAgICAgICAgLy8gIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgLy8gIGVuc3VyZSA2MHMgb2YgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBub3QgeWV0IGxvYWRlZCBhbnkgZnJhZ21lbnQsIHN0YXJ0IGxvYWRpbmcgZnJvbSBzdGFydCBwb3NpdGlvblxuICAgICAgICBpZih0aGlzLmxvYWRlZG1ldGFkYXRhKSB7XG4gICAgICAgICAgcG9zID0gdGhpcy52aWRlby5jdXJyZW50VGltZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm5leHRMb2FkUG9zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgbG9hZCBsZXZlbFxuICAgICAgICBpZih0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgbGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gd2UgYXJlIG5vdCBhdCBwbGF5YmFjayBzdGFydCwgZ2V0IG5leHQgbG9hZCBsZXZlbCBmcm9tIGxldmVsIENvbnRyb2xsZXJcbiAgICAgICAgICBsZXZlbCA9IHRoaXMuaGxzLm5leHRMb2FkTGV2ZWw7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSB0aGlzLmJ1ZmZlckluZm8ocG9zKSwgYnVmZmVyTGVuID0gYnVmZmVySW5mby5sZW4sIGJ1ZmZlckVuZCA9IGJ1ZmZlckluZm8uZW5kLCBtYXhCdWZMZW47XG4gICAgICAgIC8vIGNvbXB1dGUgbWF4IEJ1ZmZlciBMZW5ndGggdGhhdCB3ZSBjb3VsZCBnZXQgZnJvbSB0aGlzIGxvYWQgbGV2ZWwsIGJhc2VkIG9uIGxldmVsIGJpdHJhdGUuIGRvbid0IGJ1ZmZlciBtb3JlIHRoYW4gNjAgTUIgYW5kIG1vcmUgdGhhbiAzMHNcbiAgICAgICAgaWYoKHRoaXMubGV2ZWxzW2xldmVsXSkuaGFzT3duUHJvcGVydHkoJ2JpdHJhdGUnKSkge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWF4KDgqdGhpcy5jb25maWcubWF4QnVmZmVyU2l6ZS90aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSx0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWluKG1heEJ1Zkxlbix0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IHRoaXMuY29uZmlnLm1heEJ1ZmZlckxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBidWZmZXIgbGVuZ3RoIGlzIGxlc3MgdGhhbiBtYXhCdWZMZW4gdHJ5IHRvIGxvYWQgYSBuZXcgZnJhZ21lbnRcbiAgICAgICAgaWYoYnVmZmVyTGVuIDwgbWF4QnVmTGVuKSB7XG4gICAgICAgICAgLy8gc2V0IG5leHQgbG9hZCBsZXZlbCA6IHRoaXMgd2lsbCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZCBpZiBuZWVkZWRcbiAgICAgICAgICB0aGlzLmhscy5uZXh0TG9hZExldmVsID0gbGV2ZWw7XG4gICAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICAgIGxldmVsRGV0YWlscyA9IHRoaXMubGV2ZWxzW2xldmVsXS5kZXRhaWxzO1xuICAgICAgICAgIC8vIGlmIGxldmVsIGluZm8gbm90IHJldHJpZXZlZCB5ZXQsIHN3aXRjaCBzdGF0ZSBhbmQgd2FpdCBmb3IgbGV2ZWwgcmV0cmlldmFsXG4gICAgICAgICAgaWYodHlwZW9mIGxldmVsRGV0YWlscyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLldBSVRJTkdfTEVWRUw7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZmluZCBmcmFnbWVudCBpbmRleCwgY29udGlndW91cyB3aXRoIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgICBsZXQgZnJhZ21lbnRzID0gbGV2ZWxEZXRhaWxzLmZyYWdtZW50cywgZnJhZywgc2xpZGluZyA9IGxldmVsRGV0YWlscy5zbGlkaW5nLCBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCArIHNsaWRpbmcsIGRyaWZ0ID0wO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHJlcXVlc3RlZCBwb3NpdGlvbiBpcyB3aXRoaW4gc2Vla2FibGUgYm91bmRhcmllcyA6XG4gICAgICAgICAgLy8gaW4gY2FzZSBvZiBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIG5vdCBsb2NhdGVkIGJlZm9yZSBwbGF5bGlzdCBzdGFydFxuICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgc3RhcnQvcG9zL2J1ZkVuZC9zZWVraW5nOiR7c3RhcnQudG9GaXhlZCgzKX0vJHtwb3MudG9GaXhlZCgzKX0vJHtidWZmZXJFbmQudG9GaXhlZCgzKX0vJHt0aGlzLnZpZGVvLnNlZWtpbmd9YCk7XG4gICAgICAgICAgaWYoYnVmZmVyRW5kIDwgc3RhcnQpIHtcbiAgICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJTdGFsbGluZyA9IHRoaXMuc3RhcnRQb3NpdGlvbiArIHNsaWRpbmc7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGJ1ZmZlciBlbmQ6ICR7YnVmZmVyRW5kfSBpcyBsb2NhdGVkIGJlZm9yZSBzdGFydCBvZiBsaXZlIHNsaWRpbmcgcGxheWxpc3QsIG1lZGlhIHBvc2l0aW9uIHdpbGwgYmUgcmVzZXRlZCB0bzogJHt0aGlzLnNlZWtBZnRlclN0YWxsaW5nLnRvRml4ZWQoMyl9YCk7XG4gICAgICAgICAgICAgIGJ1ZmZlckVuZCA9IHRoaXMuc2Vla0FmdGVyU3RhbGxpbmc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYobGV2ZWxEZXRhaWxzLmxpdmUgJiYgbGV2ZWxEZXRhaWxzLnNsaWRpbmcgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLyogd2UgYXJlIHN3aXRjaGluZyBsZXZlbCBvbiBsaXZlIHBsYXlsaXN0LCBidXQgd2UgZG9uJ3QgaGF2ZSBhbnkgc2xpZGluZyBpbmZvIC4uLlxuICAgICAgICAgICAgICAgdHJ5IHRvIGxvYWQgZnJhZyBtYXRjaGluZyB3aXRoIG5leHQgU04uXG4gICAgICAgICAgICAgICBldmVuIGlmIFNOIGFyZSBub3Qgc3luY2hyb25pemVkIGJldHdlZW4gcGxheWxpc3RzLCBsb2FkaW5nIHRoaXMgZnJhZyB3aWxsIGhlbHAgdXNcbiAgICAgICAgICAgICAgIGNvbXB1dGUgcGxheWxpc3Qgc2xpZGluZyBhbmQgZmluZCB0aGUgcmlnaHQgb25lIGFmdGVyIGluIGNhc2UgaXQgd2FzIG5vdCB0aGUgcmlnaHQgY29uc2VjdXRpdmUgb25lICovXG4gICAgICAgICAgICBpZih0aGlzLmZyYWcpIHtcbiAgICAgICAgICAgICAgdmFyIHRhcmdldFNOID0gdGhpcy5mcmFnLnNuKzE7XG4gICAgICAgICAgICAgIGlmKHRhcmdldFNOID49IGxldmVsRGV0YWlscy5zdGFydFNOICYmIHRhcmdldFNOIDw9IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbdGFyZ2V0U04tbGV2ZWxEZXRhaWxzLnN0YXJ0U05dO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgbG9hZCBmcmFnIHdpdGggbmV4dCBTTjogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZighZnJhZykge1xuICAgICAgICAgICAgICAvKiB3ZSBoYXZlIG5vIGlkZWEgYWJvdXQgd2hpY2ggZnJhZ21lbnQgc2hvdWxkIGJlIGxvYWRlZC5cbiAgICAgICAgICAgICAgICAgc28gbGV0J3MgbG9hZCBtaWQgZnJhZ21lbnQuIGl0IHdpbGwgaGVscCBjb21wdXRpbmcgcGxheWxpc3Qgc2xpZGluZyBhbmQgZmluZCB0aGUgcmlnaHQgb25lXG4gICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbTWF0aC5yb3VuZChmcmFnbWVudHMubGVuZ3RoLzIpXTtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCB1bmtub3duLCBsb2FkIG1pZGRsZSBmcmFnIDogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb29rIGZvciBmcmFnbWVudHMgbWF0Y2hpbmcgd2l0aCBjdXJyZW50IHBsYXkgcG9zaXRpb25cbiAgICAgICAgICAgIGZvciAoZnJhZ0lkeCA9IDA7IGZyYWdJZHggPCBmcmFnbWVudHMubGVuZ3RoIDsgZnJhZ0lkeCsrKSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeF07XG4gICAgICAgICAgICAgIHN0YXJ0ID0gZnJhZy5zdGFydCtzbGlkaW5nO1xuICAgICAgICAgICAgICBpZihmcmFnLmRyaWZ0KSB7XG4gICAgICAgICAgICAgICAgZHJpZnQgPSBmcmFnLmRyaWZ0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHN0YXJ0Kz1kcmlmdDtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBsZXZlbC9zbi9zbGlkaW5nL2RyaWZ0L3N0YXJ0L2VuZC9idWZFbmQ6JHtsZXZlbH0vJHtmcmFnLnNufS8ke3NsaWRpbmcudG9GaXhlZCgzKX0vJHtkcmlmdC50b0ZpeGVkKDMpfS8ke3N0YXJ0LnRvRml4ZWQoMyl9LyR7KHN0YXJ0K2ZyYWcuZHVyYXRpb24pLnRvRml4ZWQoMyl9LyR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9YCk7XG4gICAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5XG4gICAgICAgICAgICAgIGlmKHN0YXJ0IDw9IGJ1ZmZlckVuZCAmJiAoc3RhcnQgKyBmcmFnLmR1cmF0aW9uKSA+IGJ1ZmZlckVuZCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihmcmFnSWR4ID09PSBmcmFnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIC8vIHJlYWNoIGVuZCBvZiBwbGF5bGlzdFxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgaWYodGhpcy5mcmFnICYmIGZyYWcuc24gPT09IHRoaXMuZnJhZy5zbikge1xuICAgICAgICAgICAgICBpZihmcmFnSWR4ID09PSAoZnJhZ21lbnRzLmxlbmd0aCAtMSkpIHtcbiAgICAgICAgICAgICAgICAvLyB3ZSBhcmUgYXQgdGhlIGVuZCBvZiB0aGUgcGxheWxpc3QgYW5kIHdlIGFscmVhZHkgbG9hZGVkIGxhc3QgZnJhZ21lbnQsIGRvbid0IGRvIGFueXRoaW5nXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4KzFdO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyAgICAgICAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfSwgY3VycmVudFRpbWU6JHtwb3N9LGJ1ZmZlckVuZDoke2J1ZmZlckVuZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnICAgICAgbG9hZGluZyBmcmFnICcgKyBpICsnLHBvcy9idWZFbmQ6JyArIHBvcy50b0ZpeGVkKDMpICsgJy8nICsgYnVmZmVyRW5kLnRvRml4ZWQoMykpO1xuICAgICAgICAgIGZyYWcuZHJpZnQgPSBkcmlmdDtcbiAgICAgICAgICBmcmFnLmF1dG9MZXZlbCA9IHRoaXMuaGxzLmF1dG9MZXZlbEVuYWJsZWQ7XG4gICAgICAgICAgaWYodGhpcy5sZXZlbHMubGVuZ3RoPjEpIHtcbiAgICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBNYXRoLnJvdW5kKGZyYWcuZHVyYXRpb24qdGhpcy5sZXZlbHNbbGV2ZWxdLmJpdHJhdGUvOCk7XG4gICAgICAgICAgICBmcmFnLnRyZXF1ZXN0ID0gbmV3IERhdGUoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBhcmUgbm90IHJlbG9hZGluZyB0aGUgc2FtZSBmcmFnbWVudHMgaW4gbG9vcCAuLi5cbiAgICAgICAgICBpZih0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHgrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGZyYWcubG9hZENvdW50ZXIpIHtcbiAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIrKztcbiAgICAgICAgICAgIGxldCBtYXhUaHJlc2hvbGQgPSB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICAgICAgICAvLyBpZiB0aGlzIGZyYWcgaGFzIGFscmVhZHkgYmVlbiBsb2FkZWQgMyB0aW1lcywgYW5kIGlmIGl0IGhhcyBiZWVuIHJlbG9hZGVkIHJlY2VudGx5XG4gICAgICAgICAgICBpZihmcmFnLmxvYWRDb3VudGVyID4gbWF4VGhyZXNob2xkICYmIChNYXRoLmFicyh0aGlzLmZyYWdMb2FkSWR4IC0gZnJhZy5sb2FkSWR4KSA8IG1heFRocmVzaG9sZCkpIHtcbiAgICAgICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SLCBmYXRhbDpmYWxzZSwgZnJhZyA6IGZyYWd9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyPTE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZyYWcubG9hZElkeCA9IHRoaXMuZnJhZ0xvYWRJZHg7XG4gICAgICAgICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICAgICAgICB0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FESU5HLCB7IGZyYWc6IGZyYWcgfSk7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuTE9BRElORztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5XQUlUSU5HX0xFVkVMOlxuICAgICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICBpZihsZXZlbCAmJiBsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5MT0FESU5HOlxuICAgICAgICAvKlxuICAgICAgICAgIG1vbml0b3IgZnJhZ21lbnQgcmV0cmlldmFsIHRpbWUuLi5cbiAgICAgICAgICB3ZSBjb21wdXRlIGV4cGVjdGVkIHRpbWUgb2YgYXJyaXZhbCBvZiB0aGUgY29tcGxldGUgZnJhZ21lbnQuXG4gICAgICAgICAgd2UgY29tcGFyZSBpdCB0byBleHBlY3RlZCB0aW1lIG9mIGJ1ZmZlciBzdGFydmF0aW9uXG4gICAgICAgICovXG4gICAgICAgIGxldCB2ID0gdGhpcy52aWRlbyxmcmFnID0gdGhpcy5mcmFnO1xuICAgICAgICAvKiBvbmx5IG1vbml0b3IgZnJhZyByZXRyaWV2YWwgdGltZSBpZlxuICAgICAgICAodmlkZW8gbm90IHBhdXNlZCBPUiBmaXJzdCBmcmFnbWVudCBiZWluZyBsb2FkZWQpIEFORCBhdXRvc3dpdGNoaW5nIGVuYWJsZWQgQU5EIG5vdCBsb3dlc3QgbGV2ZWwgQU5EIG11bHRpcGxlIGxldmVscyAqL1xuICAgICAgICBpZih2ICYmICghdi5wYXVzZWQgfHwgdGhpcy5sb2FkZWRtZXRhZGF0YSA9PT0gZmFsc2UpICYmIGZyYWcuYXV0b0xldmVsICYmIHRoaXMubGV2ZWwgJiYgdGhpcy5sZXZlbHMubGVuZ3RoPjEgKSB7XG4gICAgICAgICAgdmFyIHJlcXVlc3REZWxheT1uZXcgRGF0ZSgpLWZyYWcudHJlcXVlc3Q7XG4gICAgICAgICAgLy8gbW9uaXRvciBmcmFnbWVudCBsb2FkIHByb2dyZXNzIGFmdGVyIGhhbGYgb2YgZXhwZWN0ZWQgZnJhZ21lbnQgZHVyYXRpb24sdG8gc3RhYmlsaXplIGJpdHJhdGVcbiAgICAgICAgICBpZihyZXF1ZXN0RGVsYXkgPiA1MDAqZnJhZy5kdXJhdGlvbikge1xuICAgICAgICAgICAgdmFyIGxvYWRSYXRlID0gZnJhZy5sb2FkZWQqMTAwMC9yZXF1ZXN0RGVsYXk7IC8vIGJ5dGUvc1xuICAgICAgICAgICAgaWYoZnJhZy5leHBlY3RlZExlbiA8IGZyYWcubG9hZGVkKSB7XG4gICAgICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBmcmFnLmxvYWRlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBvcyA9IHYuY3VycmVudFRpbWU7XG4gICAgICAgICAgICB2YXIgZnJhZ0xvYWRlZERlbGF5ID0oZnJhZy5leHBlY3RlZExlbi1mcmFnLmxvYWRlZCkvbG9hZFJhdGU7XG4gICAgICAgICAgICB2YXIgYnVmZmVyU3RhcnZhdGlvbkRlbGF5PXRoaXMuYnVmZmVySW5mbyhwb3MpLmVuZC1wb3M7XG4gICAgICAgICAgICB2YXIgZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5ID0gZnJhZy5kdXJhdGlvbip0aGlzLmxldmVsc1t0aGlzLmhscy5uZXh0TG9hZExldmVsXS5iaXRyYXRlLyg4KmxvYWRSYXRlKTsgLy9icHMvQnBzXG4gICAgICAgICAgICAvKiBpZiB3ZSBoYXZlIGxlc3MgdGhhbiAyIGZyYWcgZHVyYXRpb24gaW4gYnVmZmVyIGFuZCBpZiBmcmFnIGxvYWRlZCBkZWxheSBpcyBncmVhdGVyIHRoYW4gYnVmZmVyIHN0YXJ2YXRpb24gZGVsYXlcbiAgICAgICAgICAgICAgLi4uIGFuZCBhbHNvIGJpZ2dlciB0aGFuIGR1cmF0aW9uIG5lZWRlZCB0byBsb2FkIGZyYWdtZW50IGF0IG5leHQgbGV2ZWwgLi4uKi9cbiAgICAgICAgICAgIGlmKGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA8IDIqZnJhZy5kdXJhdGlvbiAmJiBmcmFnTG9hZGVkRGVsYXkgPiBidWZmZXJTdGFydmF0aW9uRGVsYXkgJiYgZnJhZ0xvYWRlZERlbGF5ID4gZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5KSB7XG4gICAgICAgICAgICAgIC8vIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgLi4uXG4gICAgICAgICAgICAgIGxvZ2dlci53YXJuKCdsb2FkaW5nIHRvbyBzbG93LCBhYm9ydCBmcmFnbWVudCBsb2FkaW5nJyk7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZyYWdMb2FkZWREZWxheS9idWZmZXJTdGFydmF0aW9uRGVsYXkvZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5IDoke2ZyYWdMb2FkZWREZWxheS50b0ZpeGVkKDEpfS8ke2J1ZmZlclN0YXJ2YXRpb25EZWxheS50b0ZpeGVkKDEpfS8ke2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheS50b0ZpeGVkKDEpfWApO1xuICAgICAgICAgICAgICAvL2Fib3J0IGZyYWdtZW50IGxvYWRpbmdcbiAgICAgICAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQsIHsgZnJhZzogZnJhZyB9KTtcbiAgICAgICAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSB0byByZXF1ZXN0IG5ldyBmcmFnbWVudCBhdCBsb3dlc3QgbGV2ZWxcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuUEFSU0lORzpcbiAgICAgICAgLy8gbm90aGluZyB0byBkbywgd2FpdCBmb3IgZnJhZ21lbnQgYmVpbmcgcGFyc2VkXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSB0aGlzLlBBUlNFRDpcbiAgICAgIGNhc2UgdGhpcy5BUFBFTkRJTkc6XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICAgIC8vIGlmIE1QNCBzZWdtZW50IGFwcGVuZGluZyBpbiBwcm9ncmVzcyBub3RoaW5nIHRvIGRvXG4gICAgICAgICAgaWYoKHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvICYmIHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvLnVwZGF0aW5nKSB8fFxuICAgICAgICAgICAgICh0aGlzLnNvdXJjZUJ1ZmZlci52aWRlbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci52aWRlby51cGRhdGluZykpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnc2IgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgIC8vIGNoZWNrIGlmIGFueSBNUDQgc2VnbWVudHMgbGVmdCB0byBhcHBlbmRcbiAgICAgICAgICB9IGVsc2UgaWYodGhpcy5tcDRzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBzZWdtZW50ID0gdGhpcy5tcDRzZWdtZW50cy5zaGlmdCgpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBhcHBlbmRpbmcgJHtzZWdtZW50LnR5cGV9IFNCLCBzaXplOiR7c2VnbWVudC5kYXRhLmxlbmd0aH1gKTtcbiAgICAgICAgICAgICAgdGhpcy5zb3VyY2VCdWZmZXJbc2VnbWVudC50eXBlXS5hcHBlbmRCdWZmZXIoc2VnbWVudC5kYXRhKTtcbiAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvcj0wO1xuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgLy8gaW4gY2FzZSBhbnkgZXJyb3Igb2NjdXJlZCB3aGlsZSBhcHBlbmRpbmcsIHB1dCBiYWNrIHNlZ21lbnQgaW4gbXA0c2VnbWVudHMgdGFibGVcbiAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBlcnJvciB3aGlsZSB0cnlpbmcgdG8gYXBwZW5kIGJ1ZmZlcjoke2Vyci5tZXNzYWdlfSx0cnkgYXBwZW5kaW5nIGxhdGVyYCk7XG4gICAgICAgICAgICAgIHRoaXMubXA0c2VnbWVudHMudW5zaGlmdChzZWdtZW50KTtcbiAgICAgICAgICAgICAgaWYodGhpcy5hcHBlbmRFcnJvcikge1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yPTE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGV2ZW50ID0ge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfQVBQRU5ESU5HX0VSUk9SLCBmcmFnIDogdGhpcy5mcmFnfTtcbiAgICAgICAgICAgICAgLyogd2l0aCBVSEQgY29udGVudCwgd2UgY291bGQgZ2V0IGxvb3Agb2YgcXVvdGEgZXhjZWVkZWQgZXJyb3IgdW50aWxcbiAgICAgICAgICAgICAgICBicm93c2VyIGlzIGFibGUgdG8gZXZpY3Qgc29tZSBkYXRhIGZyb20gc291cmNlYnVmZmVyLiByZXRyeWluZyBoZWxwIHJlY292ZXJpbmcgdGhpc1xuICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICBpZih0aGlzLmFwcGVuZEVycm9yID4gdGhpcy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZhaWwgJHt0aGlzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5fSB0aW1lcyB0byBhcHBlbmQgc2VnbWVudCBpbiBzb3VyY2VCdWZmZXJgKTtcbiAgICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLkVSUk9SO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIGV2ZW50KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuQVBQRU5ESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBzb3VyY2VCdWZmZXIgdW5kZWZpbmVkLCBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlXG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5CVUZGRVJfRkxVU0hJTkc6XG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBhbGwgYnVmZmVyIHJhbmdlcyB0byBmbHVzaFxuICAgICAgICB3aGlsZSh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHJhbmdlID0gdGhpcy5mbHVzaFJhbmdlWzBdO1xuICAgICAgICAgIC8vIGZsdXNoQnVmZmVyIHdpbGwgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MgYW5kIGZsdXNoIEF1ZGlvL1ZpZGVvIEJ1ZmZlclxuICAgICAgICAgIGlmKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQscmFuZ2UuZW5kKSkge1xuICAgICAgICAgICAgLy8gcmFuZ2UgZmx1c2hlZCwgcmVtb3ZlIGZyb20gZmx1c2ggYXJyYXlcbiAgICAgICAgICAgIHRoaXMuZmx1c2hSYW5nZS5zaGlmdCgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmbHVzaCBpbiBwcm9ncmVzcywgY29tZSBiYWNrIGxhdGVyXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgLy8gbW92ZSB0byBJRExFIG9uY2UgZmx1c2ggY29tcGxldGUuIHRoaXMgc2hvdWxkIHRyaWdnZXIgbmV3IGZyYWdtZW50IGxvYWRpbmdcbiAgICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgICAgIC8vIHJlc2V0IHJlZmVyZW5jZSB0byBmcmFnXG4gICAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICAgLyogaWYgbm90IGV2ZXJ5dGhpbmcgZmx1c2hlZCwgc3RheSBpbiBCVUZGRVJfRkxVU0hJTkcgc3RhdGUuIHdlIHdpbGwgY29tZSBiYWNrIGhlcmVcbiAgICAgICAgICAgIGVhY2ggdGltZSBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgY2FsbGJhY2sgd2lsbCBiZSB0cmlnZ2VyZWRcbiAgICAgICAgICAgICovXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8vIGNoZWNrL3VwZGF0ZSBjdXJyZW50IGZyYWdtZW50XG4gICAgdGhpcy5fY2hlY2tGcmFnbWVudENoYW5nZWQoKTtcbiAgfVxuXG4gICBidWZmZXJJbmZvKHBvcykge1xuICAgIHZhciB2ID0gdGhpcy52aWRlbyxcbiAgICAgICAgYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkLFxuICAgICAgICBidWZmZXJMZW4sXG4gICAgICAgIC8vIGJ1ZmZlclN0YXJ0IGFuZCBidWZmZXJFbmQgYXJlIGJ1ZmZlciBib3VuZGFyaWVzIGFyb3VuZCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uXG4gICAgICAgIGJ1ZmZlclN0YXJ0LGJ1ZmZlckVuZCxcbiAgICAgICAgaTtcbiAgICB2YXIgYnVmZmVyZWQyID0gW107XG4gICAgLy8gdGhlcmUgbWlnaHQgYmUgc29tZSBzbWFsbCBob2xlcyBiZXR3ZWVuIGJ1ZmZlciB0aW1lIHJhbmdlXG4gICAgLy8gY29uc2lkZXIgdGhhdCBob2xlcyBzbWFsbGVyIHRoYW4gMzAwIG1zIGFyZSBpcnJlbGV2YW50IGFuZCBidWlsZCBhbm90aGVyXG4gICAgLy8gYnVmZmVyIHRpbWUgcmFuZ2UgcmVwcmVzZW50YXRpb25zIHRoYXQgZGlzY2FyZHMgdGhvc2UgaG9sZXNcbiAgICBmb3IoaSA9IDAgOyBpIDwgYnVmZmVyZWQubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmKChidWZmZXJlZDIubGVuZ3RoKSAmJiAoYnVmZmVyZWQuc3RhcnQoaSkgLSBidWZmZXJlZDJbYnVmZmVyZWQyLmxlbmd0aC0xXS5lbmQgKSA8IDAuMykge1xuICAgICAgICBidWZmZXJlZDJbYnVmZmVyZWQyLmxlbmd0aC0xXS5lbmQgPSBidWZmZXJlZC5lbmQoaSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidWZmZXJlZDIucHVzaCh7c3RhcnQgOiBidWZmZXJlZC5zdGFydChpKSxlbmQgOiBidWZmZXJlZC5lbmQoaSl9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gcG9zIDsgaSA8IGJ1ZmZlcmVkMi5sZW5ndGggOyBpKyspIHtcbiAgICAgIC8vbG9nZ2VyLmxvZygnYnVmIHN0YXJ0L2VuZDonICsgYnVmZmVyZWQuc3RhcnQoaSkgKyAnLycgKyBidWZmZXJlZC5lbmQoaSkpO1xuICAgICAgaWYoKHBvcyswLjMpID49IGJ1ZmZlcmVkMltpXS5zdGFydCAmJiBwb3MgPCBidWZmZXJlZDJbaV0uZW5kKSB7XG4gICAgICAgIC8vIHBsYXkgcG9zaXRpb24gaXMgaW5zaWRlIHRoaXMgYnVmZmVyIFRpbWVSYW5nZSwgcmV0cmlldmUgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvbiBhbmQgYnVmZmVyIGxlbmd0aFxuICAgICAgICBidWZmZXJTdGFydCA9IGJ1ZmZlcmVkMltpXS5zdGFydDtcbiAgICAgICAgYnVmZmVyRW5kID0gYnVmZmVyZWQyW2ldLmVuZCArIDAuMztcbiAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVyRW5kIC0gcG9zO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge2xlbiA6IGJ1ZmZlckxlbiwgc3RhcnQgOiBidWZmZXJTdGFydCwgZW5kIDogYnVmZmVyRW5kfTtcbiAgfVxuXG5cbiAgZ2V0QnVmZmVyUmFuZ2UocG9zaXRpb24pIHtcbiAgICB2YXIgaSxyYW5nZTtcbiAgICBmb3IgKGkgPSB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aC0xOyBpID49MCA7IGktLSkge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYocG9zaXRpb24gPj0gcmFuZ2Uuc3RhcnQgJiYgcG9zaXRpb24gPD0gcmFuZ2UuZW5kKSB7XG4gICAgICAgIHJldHVybiByYW5nZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdmFyIHJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKTtcbiAgICAgIGlmKHJhbmdlKSB7XG4gICAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBnZXQgbmV4dEJ1ZmZlclJhbmdlKCkge1xuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIC8vIGZpcnN0IGdldCBlbmQgcmFuZ2Ugb2YgY3VycmVudCBmcmFnbWVudFxuICAgICAgcmV0dXJuIHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UodGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZvbGxvd2luZ0J1ZmZlclJhbmdlKHJhbmdlKSB7XG4gICAgaWYocmFuZ2UpIHtcbiAgICAgIC8vIHRyeSB0byBnZXQgcmFuZ2Ugb2YgbmV4dCBmcmFnbWVudCAoNTAwbXMgYWZ0ZXIgdGhpcyByYW5nZSlcbiAgICAgIHJldHVybiB0aGlzLmdldEJ1ZmZlclJhbmdlKHJhbmdlLmVuZCswLjUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICB2YXIgcmFuZ2UgPSB0aGlzLm5leHRCdWZmZXJSYW5nZTtcbiAgICBpZihyYW5nZSkge1xuICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gIH1cblxuICBpc0J1ZmZlcmVkKHBvc2l0aW9uKSB7XG4gICAgdmFyIHYgPSB0aGlzLnZpZGVvLGJ1ZmZlcmVkID0gdi5idWZmZXJlZDtcbiAgICBmb3IodmFyIGkgPSAwIDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aCA7IGkrKykge1xuICAgICAgaWYocG9zaXRpb24gPj0gYnVmZmVyZWQuc3RhcnQoaSkgJiYgcG9zaXRpb24gPD0gYnVmZmVyZWQuZW5kKGkpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfY2hlY2tGcmFnbWVudENoYW5nZWQoKSB7XG4gICAgdmFyIHJhbmdlQ3VycmVudCwgY3VycmVudFRpbWU7XG4gICAgaWYodGhpcy52aWRlbyAmJiB0aGlzLnZpZGVvLnNlZWtpbmcgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lID0gdGhpcy52aWRlby5jdXJyZW50VGltZTtcbiAgICAgIGlmKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSkpIHtcbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSk7XG4gICAgICB9IGVsc2UgaWYodGhpcy5pc0J1ZmZlcmVkKGN1cnJlbnRUaW1lKzAuMSkpIHtcbiAgICAgICAgLyogZW5zdXJlIHRoYXQgRlJBR19DSEFOR0VEIGV2ZW50IGlzIHRyaWdnZXJlZCBhdCBzdGFydHVwLFxuICAgICAgICAgIHdoZW4gZmlyc3QgdmlkZW8gZnJhbWUgaXMgZGlzcGxheWVkIGFuZCBwbGF5YmFjayBpcyBwYXVzZWQuXG4gICAgICAgICAgYWRkIGEgdG9sZXJhbmNlIG9mIDEwMG1zLCBpbiBjYXNlIGN1cnJlbnQgcG9zaXRpb24gaXMgbm90IGJ1ZmZlcmVkLFxuICAgICAgICAgIGNoZWNrIGlmIGN1cnJlbnQgcG9zKzEwMG1zIGlzIGJ1ZmZlcmVkIGFuZCB1c2UgdGhhdCBidWZmZXIgcmFuZ2VcbiAgICAgICAgICBmb3IgRlJBR19DSEFOR0VEIGV2ZW50IHJlcG9ydGluZyAqL1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lKzAuMSk7XG4gICAgICB9XG4gICAgICBpZihyYW5nZUN1cnJlbnQpIHtcbiAgICAgICAgaWYocmFuZ2VDdXJyZW50LmZyYWcgIT09IHRoaXMuZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gcmFuZ2VDdXJyZW50LmZyYWc7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0NIQU5HRUQsIHsgZnJhZyA6IHRoaXMuZnJhZ0N1cnJlbnQgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgc3RyZWFtIGlzIFZPRCAobm90IGxpdmUpIGFuZCB3ZSByZWFjaCBFbmQgb2YgU3RyZWFtXG4gICAgICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgICBpZihsZXZlbCAmJiBsZXZlbC5kZXRhaWxzICYmICFsZXZlbC5kZXRhaWxzLmxpdmUgJiYgKHRoaXMudmlkZW8uZHVyYXRpb24gLSBjdXJyZW50VGltZSkgPCAwLjIpIHtcbiAgICAgICAgICBpZih0aGlzLm1lZGlhU291cmNlICYmIHRoaXMubWVkaWFTb3VyY2UucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nKGBlbmQgb2YgVm9EIHN0cmVhbSByZWFjaGVkLCBzaWduYWwgZW5kT2ZTdHJlYW0oKSB0byBNZWRpYVNvdXJjZWApO1xuICAgICAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICAgICAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuLypcbiAgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MsIGFuZCBmbHVzaCBhbGwgYnVmZmVyZWQgZGF0YVxuICByZXR1cm4gdHJ1ZSBvbmNlIGV2ZXJ5dGhpbmcgaGFzIGJlZW4gZmx1c2hlZC5cbiAgc291cmNlQnVmZmVyLmFib3J0KCkgYW5kIHNvdXJjZUJ1ZmZlci5yZW1vdmUoKSBhcmUgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnNcbiAgdGhlIGlkZWEgaXMgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIGZyb20gdGljaygpIHRpbWVyIGFuZCBjYWxsIGl0IGFnYWluIHVudGlsIGFsbCByZXNvdXJjZXMgaGF2ZSBiZWVuIGNsZWFuZWRcbiAgdGhlIHRpbWVyIGlzIHJlYXJtZWQgdXBvbiBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgZXZlbnQsIHNvIHRoaXMgc2hvdWxkIGJlIG9wdGltYWxcbiovXG4gIGZsdXNoQnVmZmVyKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpIHtcbiAgICB2YXIgc2IsaSxidWZTdGFydCxidWZFbmQsIGZsdXNoU3RhcnQsIGZsdXNoRW5kO1xuICAgIC8vbG9nZ2VyLmxvZygnZmx1c2hCdWZmZXIscG9zL3N0YXJ0L2VuZDogJyArIHRoaXMudmlkZW8uY3VycmVudFRpbWUgKyAnLycgKyBzdGFydE9mZnNldCArICcvJyArIGVuZE9mZnNldCk7XG4gICAgLy8gc2FmZWd1YXJkIHRvIGF2b2lkIGluZmluaXRlIGxvb3BpbmdcbiAgICBpZih0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrIDwgMip0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIGlmKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvcihpID0gMCA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgICAgIGJ1ZlN0YXJ0ID0gc2IuYnVmZmVyZWQuc3RhcnQoaSk7XG4gICAgICAgICAgICBidWZFbmQgPSBzYi5idWZmZXJlZC5lbmQoaSk7XG4gICAgICAgICAgICAvLyB3b3JrYXJvdW5kIGZpcmVmb3ggbm90IGFibGUgdG8gcHJvcGVybHkgZmx1c2ggbXVsdGlwbGUgYnVmZmVyZWQgcmFuZ2UuXG4gICAgICAgICAgICBpZihuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiAgZW5kT2Zmc2V0ID09PSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IHN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgICBmbHVzaEVuZCA9IGVuZE9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBNYXRoLm1heChidWZTdGFydCxzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBzb21ldGltZXMgc291cmNlYnVmZmVyLnJlbW92ZSgpIGRvZXMgbm90IGZsdXNoXG4gICAgICAgICAgICAgICB0aGUgZXhhY3QgZXhwZWN0ZWQgdGltZSByYW5nZS5cbiAgICAgICAgICAgICAgIHRvIGF2b2lkIHJvdW5kaW5nIGlzc3Vlcy9pbmZpbml0ZSBsb29wLFxuICAgICAgICAgICAgICAgb25seSBmbHVzaCBidWZmZXIgcmFuZ2Ugb2YgbGVuZ3RoIGdyZWF0ZXIgdGhhbiA1MDBtcy5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZihmbHVzaEVuZCAtIGZsdXNoU3RhcnQgPiAwLjUpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmx1c2ggJHt0eXBlfSBbJHtmbHVzaFN0YXJ0fSwke2ZsdXNoRW5kfV0sIG9mIFske2J1ZlN0YXJ0fSwke2J1ZkVuZH1dLCBwb3M6JHt0aGlzLnZpZGVvLmN1cnJlbnRUaW1lfWApO1xuICAgICAgICAgICAgICBzYi5yZW1vdmUoZmx1c2hTdGFydCxmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZTtcbiAgICBmb3IgKGkgPSAwIDsgaSA8IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoIDsgaSsrKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZih0aGlzLmlzQnVmZmVyZWQoKHJhbmdlLnN0YXJ0ICsgcmFuZ2UuZW5kKS8yKSkge1xuICAgICAgICBuZXdSYW5nZS5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IG5ld1JhbmdlO1xuXG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGZsdXNoZWQnKTtcbiAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWQgIVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgICAvKlxuICAgICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCA6XG4gICAgICAgLSBwYXVzZSBwbGF5YmFjayBpZiBwbGF5aW5nXG4gICAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgICAgLSBhbmQgdHJpZ2dlciBhIGJ1ZmZlciBmbHVzaFxuICAgICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoKCkge1xuICAgIGxvZ2dlci5sb2coJ2ltbWVkaWF0ZUxldmVsU3dpdGNoJyk7XG4gICAgaWYoIXRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzbHlQYXVzZWQgPSB0aGlzLnZpZGVvLnBhdXNlZDtcbiAgICAgIHRoaXMudmlkZW8ucGF1c2UoKTtcbiAgICB9XG4gICAgaWYodGhpcy5mcmFnICYmIHRoaXMuZnJhZy5sb2FkZXIpIHtcbiAgICAgIHRoaXMuZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5mcmFnPW51bGw7XG4gICAgLy8gZmx1c2ggZXZlcnl0aGluZ1xuICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7IHN0YXJ0IDogMCwgZW5kIDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgLy8gdHJpZ2dlciBhIHNvdXJjZUJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuc3RhdGUgPSB0aGlzLkJVRkZFUl9GTFVTSElORztcbiAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuZnJhZ0xvYWRJZHgrPTIqdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbi8qXG4gICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIGVuZCwgYWZ0ZXIgbmV3IGZyYWdtZW50IGhhcyBiZWVuIGJ1ZmZlcmVkIDpcbiAgICAtIG51ZGdlIHZpZGVvIGRlY29kZXIgYnkgc2xpZ2h0bHkgYWRqdXN0aW5nIHZpZGVvIGN1cnJlbnRUaW1lXG4gICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKSB7XG4gICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSBmYWxzZTtcbiAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lLT0wLjAwMDE7XG4gICAgaWYoIXRoaXMucHJldmlvdXNseVBhdXNlZCkge1xuICAgICAgdGhpcy52aWRlby5wbGF5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExldmVsU3dpdGNoKCkge1xuICAgIC8qIHRyeSB0byBzd2l0Y2ggQVNBUCB3aXRob3V0IGJyZWFraW5nIHZpZGVvIHBsYXliYWNrIDpcbiAgICAgICBpbiBvcmRlciB0byBlbnN1cmUgc21vb3RoIGJ1dCBxdWljayBsZXZlbCBzd2l0Y2hpbmcsXG4gICAgICB3ZSBuZWVkIHRvIGZpbmQgdGhlIG5leHQgZmx1c2hhYmxlIGJ1ZmZlciByYW5nZVxuICAgICAgd2Ugc2hvdWxkIHRha2UgaW50byBhY2NvdW50IG5ldyBzZWdtZW50IGZldGNoIHRpbWVcbiAgICAqL1xuICAgIHZhciBmZXRjaGRlbGF5LGN1cnJlbnRSYW5nZSxuZXh0UmFuZ2U7XG5cbiAgICBjdXJyZW50UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUpO1xuICAgIGlmKGN1cnJlbnRSYW5nZSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7IHN0YXJ0IDogMCwgZW5kIDogY3VycmVudFJhbmdlLnN0YXJ0LTF9KTtcbiAgICB9XG5cbiAgICBpZighdGhpcy52aWRlby5wYXVzZWQpIHtcbiAgICAgIC8vIGFkZCBhIHNhZmV0eSBkZWxheSBvZiAxc1xuICAgICAgdmFyIG5leHRMZXZlbElkID0gdGhpcy5obHMubmV4dExvYWRMZXZlbCxuZXh0TGV2ZWwgPSB0aGlzLmxldmVsc1tuZXh0TGV2ZWxJZF07XG4gICAgICBpZih0aGlzLmhscy5zdGF0cy5mcmFnTGFzdEticHMgJiYgdGhpcy5mcmFnKSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSB0aGlzLmZyYWcuZHVyYXRpb24qbmV4dExldmVsLmJpdHJhdGUvKDEwMDAqdGhpcy5obHMuc3RhdHMuZnJhZ0xhc3RLYnBzKSsxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZldGNoZGVsYXk6JytmZXRjaGRlbGF5KTtcbiAgICAvLyBmaW5kIGJ1ZmZlciByYW5nZSB0aGF0IHdpbGwgYmUgcmVhY2hlZCBvbmNlIG5ldyBmcmFnbWVudCB3aWxsIGJlIGZldGNoZWRcbiAgICBuZXh0UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUgKyBmZXRjaGRlbGF5KTtcbiAgICBpZihuZXh0UmFuZ2UpIHtcbiAgICAgIC8vIHdlIGNhbiBmbHVzaCBidWZmZXIgcmFuZ2UgZm9sbG93aW5nIHRoaXMgb25lIHdpdGhvdXQgc3RhbGxpbmcgcGxheWJhY2tcbiAgICAgIG5leHRSYW5nZSA9IHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UobmV4dFJhbmdlKTtcbiAgICAgIGlmKG5leHRSYW5nZSkge1xuICAgICAgICAvLyBmbHVzaCBwb3NpdGlvbiBpcyB0aGUgc3RhcnQgcG9zaXRpb24gb2YgdGhpcyBuZXcgYnVmZmVyXG4gICAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHsgc3RhcnQgOiBuZXh0UmFuZ2Uuc3RhcnQsIGVuZCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgfVxuICAgIH1cbiAgICBpZih0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgICAvLyB0cmlnZ2VyIGEgc291cmNlQnVmZmVyIGZsdXNoXG4gICAgICB0aGlzLnN0YXRlID0gdGhpcy5CVUZGRVJfRkxVU0hJTkc7XG4gICAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgICAgdGhpcy5mcmFnTG9hZElkeCs9Mip0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uTVNFQXR0YWNoZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMudmlkZW8gPSBkYXRhLnZpZGVvO1xuICAgIHRoaXMubWVkaWFTb3VyY2UgPSBkYXRhLm1lZGlhU291cmNlO1xuICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub25WaWRlb1NlZWtpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udnNlZWtlZCA9IHRoaXMub25WaWRlb1NlZWtlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252bWV0YWRhdGEgPSB0aGlzLm9uVmlkZW9NZXRhZGF0YS5iaW5kKHRoaXMpO1xuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsdGhpcy5vbnZzZWVraW5nKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsdGhpcy5vbnZzZWVrZWQpO1xuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLHRoaXMub252bWV0YWRhdGEpO1xuICAgIGlmKHRoaXMubGV2ZWxzICYmIHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICB9XG5cbiAgb25NU0VEZXRhY2hlZCgpIHtcbiAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgdGhpcy5zdG9wKCk7XG4gIH1cblxuXG4gIG9uVmlkZW9TZWVraW5nKCkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuTE9BRElORykge1xuICAgICAgLy8gY2hlY2sgaWYgY3VycmVudGx5IGxvYWRlZCBmcmFnbWVudCBpcyBpbnNpZGUgYnVmZmVyLlxuICAgICAgLy9pZiBvdXRzaWRlLCBjYW5jZWwgZnJhZ21lbnQgbG9hZGluZywgb3RoZXJ3aXNlIGRvIG5vdGhpbmdcbiAgICAgIGlmKHRoaXMuYnVmZmVySW5mbyh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKS5sZW4gPT09IDApIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgICB0aGlzLmZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICAgIC8vIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIGxvYWQgbmV3IGZyYWdtZW50XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy52aWRlby5jdXJyZW50VGltZTtcbiAgICB9XG4gICAgLy8gYXZvaWQgcmVwb3J0aW5nIGZyYWdtZW50IGxvb3AgbG9hZGluZyBlcnJvciBpbiBjYXNlIHVzZXIgaXMgc2Vla2luZyBzZXZlcmFsIHRpbWVzIG9uIHNhbWUgcG9zaXRpb25cbiAgICBpZih0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHgrPSAyKnRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICB9XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBwcm9jZXNzaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblZpZGVvU2Vla2VkKCkge1xuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgRlJBR01FTlRfUExBWUlORyB0cmlnZ2VyaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblZpZGVvTWV0YWRhdGEoKSB7XG4gICAgICBpZih0aGlzLnZpZGVvLmN1cnJlbnRUaW1lICE9PSB0aGlzLnN0YXJ0UG9zaXRpb24pIHtcbiAgICAgICAgdGhpcy52aWRlby5jdXJyZW50VGltZSA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICB9XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IHRydWU7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1hbmlmZXN0UGFyc2VkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgYWFjPWZhbHNlLCBoZWFhYz1mYWxzZSxjb2RlY3M7XG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAvLyBkZXRlY3QgaWYgd2UgaGF2ZSBkaWZmZXJlbnQga2luZCBvZiBhdWRpbyBjb2RlY3MgdXNlZCBhbW9uZ3N0IHBsYXlsaXN0c1xuICAgICAgY29kZWNzID0gbGV2ZWwuY29kZWNzO1xuICAgICAgaWYoY29kZWNzKSB7XG4gICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEpIHtcbiAgICAgICAgICBhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpIHtcbiAgICAgICAgICBoZWFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmF1ZGlvY29kZWNzd2l0Y2ggPSAoYWFjICYmIGhlYWFjKTtcbiAgICBpZih0aGlzLmF1ZGlvY29kZWNzd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBhdWRpbyBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgICBpZih0aGlzLnZpZGVvICYmIHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIG5ld0xldmVsRGV0YWlscyA9IGRhdGEuZGV0YWlscyxcbiAgICAgICAgZHVyYXRpb24gPSBuZXdMZXZlbERldGFpbHMudG90YWxkdXJhdGlvbixcbiAgICAgICAgbmV3TGV2ZWxJZCA9IGRhdGEubGV2ZWwsXG4gICAgICAgIG5ld0xldmVsID0gdGhpcy5sZXZlbHNbbmV3TGV2ZWxJZF0sXG4gICAgICAgIGN1ckxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0sXG4gICAgICAgIHNsaWRpbmcgPSAwO1xuICAgIGxvZ2dlci5sb2coYGxldmVsICR7bmV3TGV2ZWxJZH0gbG9hZGVkIFske25ld0xldmVsRGV0YWlscy5zdGFydFNOfSwke25ld0xldmVsRGV0YWlscy5lbmRTTn1dLGR1cmF0aW9uOiR7ZHVyYXRpb259YCk7XG4gICAgLy8gY2hlY2sgaWYgcGxheWxpc3QgaXMgYWxyZWFkeSBsb2FkZWQgKGlmIHllcywgaXQgc2hvdWxkIGJlIGEgbGl2ZSBwbGF5bGlzdClcbiAgICBpZihjdXJMZXZlbCAmJiBjdXJMZXZlbC5kZXRhaWxzICYmIGN1ckxldmVsLmRldGFpbHMubGl2ZSkge1xuICAgICAgdmFyIGN1ckxldmVsRGV0YWlscyA9IGN1ckxldmVsLmRldGFpbHM7XG4gICAgICAvLyAgcGxheWxpc3Qgc2xpZGluZyBpcyB0aGUgc3VtIG9mIDogY3VycmVudCBwbGF5bGlzdCBzbGlkaW5nICsgc2xpZGluZyBvZiBuZXcgcGxheWxpc3QgY29tcGFyZWQgdG8gY3VycmVudCBvbmVcbiAgICAgIC8vIGNoZWNrIHNsaWRpbmcgb2YgdXBkYXRlZCBwbGF5bGlzdCBhZ2FpbnN0IGN1cnJlbnQgb25lIDpcbiAgICAgIC8vIGFuZCBmaW5kIGl0cyBwb3NpdGlvbiBpbiBjdXJyZW50IHBsYXlsaXN0XG4gICAgICAvL2xvZ2dlci5sb2coXCJmcmFnbWVudHNbMF0uc24vdGhpcy5sZXZlbC9jdXJMZXZlbC5kZXRhaWxzLmZyYWdtZW50c1swXS5zbjpcIiArIGZyYWdtZW50c1swXS5zbiArIFwiL1wiICsgdGhpcy5sZXZlbCArIFwiL1wiICsgY3VyTGV2ZWwuZGV0YWlscy5mcmFnbWVudHNbMF0uc24pO1xuICAgICAgdmFyIFNOZGlmZiA9IG5ld0xldmVsRGV0YWlscy5zdGFydFNOIC0gY3VyTGV2ZWxEZXRhaWxzLnN0YXJ0U047XG4gICAgICBpZihTTmRpZmYgPj0wKSB7XG4gICAgICAgIC8vIHBvc2l0aXZlIHNsaWRpbmcgOiBuZXcgcGxheWxpc3Qgc2xpZGluZyB3aW5kb3cgaXMgYWZ0ZXIgcHJldmlvdXMgb25lXG4gICAgICAgIHZhciBvbGRmcmFnbWVudHMgPSBjdXJMZXZlbERldGFpbHMuZnJhZ21lbnRzO1xuICAgICAgICBpZiggU05kaWZmIDwgb2xkZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgIHNsaWRpbmcgPSBjdXJMZXZlbERldGFpbHMuc2xpZGluZyArIG9sZGZyYWdtZW50c1tTTmRpZmZdLnN0YXJ0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ2dlci5sb2coYGNhbm5vdCBjb21wdXRlIHNsaWRpbmcsIG5vIFNOIGluIGNvbW1vbiBiZXR3ZWVuIG9sZC9uZXcgbGV2ZWw6WyR7Y3VyTGV2ZWxEZXRhaWxzLnN0YXJ0U059LCR7Y3VyTGV2ZWxEZXRhaWxzLmVuZFNOfV0vWyR7bmV3TGV2ZWxEZXRhaWxzLnN0YXJ0U059LCR7bmV3TGV2ZWxEZXRhaWxzLmVuZFNOfV1gKTtcbiAgICAgICAgICBzbGlkaW5nID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBuZWdhdGl2ZSBzbGlkaW5nOiBuZXcgcGxheWxpc3Qgc2xpZGluZyB3aW5kb3cgaXMgYmVmb3JlIHByZXZpb3VzIG9uZVxuICAgICAgICBzbGlkaW5nID0gY3VyTGV2ZWxEZXRhaWxzLnNsaWRpbmcgLSBuZXdMZXZlbERldGFpbHMuZnJhZ21lbnRzWy1TTmRpZmZdLnN0YXJ0O1xuICAgICAgfVxuICAgICAgaWYoc2xpZGluZykge1xuICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0IHNsaWRpbmc6JHtzbGlkaW5nLnRvRml4ZWQoMyl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIG92ZXJyaWRlIGxldmVsIGluZm9cbiAgICBuZXdMZXZlbC5kZXRhaWxzID0gbmV3TGV2ZWxEZXRhaWxzO1xuICAgIG5ld0xldmVsLmRldGFpbHMuc2xpZGluZyA9IHNsaWRpbmc7XG4gICAgaWYodGhpcy5zdGFydExldmVsTG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tM1xuICAgICAgaWYobmV3TGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCxkdXJhdGlvbiAtIDMgKiBuZXdMZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgfVxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gb25seSBzd2l0Y2ggYmF0Y2sgdG8gSURMRSBzdGF0ZSBpZiB3ZSB3ZXJlIHdhaXRpbmcgZm9yIGxldmVsIHRvIHN0YXJ0IGRvd25sb2FkaW5nIGEgbmV3IGZyYWdtZW50XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gdGhpcy5XQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuTE9BRElORykge1xuICAgICAgaWYodGhpcy5mcmFnbWVudEJpdHJhdGVUZXN0ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgLi4uIHdlIGp1c3QgbG9hZGVkIGEgZnJhZ21lbnQgdG8gZGV0ZXJtaW5lIGFkZXF1YXRlIHN0YXJ0IGJpdHJhdGUgYW5kIGluaXRpYWxpemUgYXV0b3N3aXRjaCBhbGdvXG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9IGZhbHNlO1xuICAgICAgICBkYXRhLnN0YXRzLnRwYXJzZWQgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwgeyBzdGF0cyA6IGRhdGEuc3RhdHMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLlBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSwgZGV0YWlscyA9IGN1cnJlbnRMZXZlbC5kZXRhaWxzLCAgZHVyYXRpb24gPSAgZGV0YWlscy50b3RhbGR1cmF0aW9uLCBzdGFydCA9IHRoaXMuZnJhZy5zdGFydDtcbiAgICAgICAgaWYoZGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgZHVyYXRpb24rPWRldGFpbHMuc2xpZGluZztcbiAgICAgICAgICBzdGFydCs9ZGV0YWlscy5zbGlkaW5nO1xuICAgICAgICB9XG4gICAgICAgIGlmKHRoaXMuZnJhZy5kcmlmdCkge1xuICAgICAgICAgIHN0YXJ0Kz0gdGhpcy5mcmFnLmRyaWZ0O1xuICAgICAgICB9XG4gICAgICAgIGxvZ2dlci5sb2coYERlbXV4aW5nICAgICAgJHt0aGlzLmZyYWcuc259IG9mIFske2RldGFpbHMuc3RhcnRTTn0gLCR7ZGV0YWlscy5lbmRTTn1dLGxldmVsICR7dGhpcy5sZXZlbH1gKTtcbiAgICAgICAgdGhpcy5kZW11eGVyLnB1c2goZGF0YS5wYXlsb2FkLGN1cnJlbnRMZXZlbC5hdWRpb0NvZGVjLGN1cnJlbnRMZXZlbC52aWRlb0NvZGVjLHN0YXJ0LHRoaXMuZnJhZy5jYywgdGhpcy5sZXZlbCwgZHVyYXRpb24pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uSW5pdFNlZ21lbnQoZXZlbnQsZGF0YSkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuUEFSU0lORykge1xuICAgICAgLy8gY2hlY2sgaWYgY29kZWNzIGhhdmUgYmVlbiBleHBsaWNpdGVseSBkZWZpbmVkIGluIHRoZSBtYXN0ZXIgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWw7XG4gICAgICAvLyBpZiB5ZXMgdXNlIHRoZXNlIG9uZXMgaW5zdGVhZCBvZiB0aGUgb25lcyBwYXJzZWQgZnJvbSB0aGUgZGVtdXhcbiAgICAgIHZhciBhdWRpb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uYXVkaW9Db2RlYywgdmlkZW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWMsc2I7XG4gICAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGxldmVsIEEvViBjb2RlY3M6JyArIGF1ZGlvQ29kZWMgKyAnLCcgKyB2aWRlb0NvZGVjKTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncGxheWxpc3QgY29kZWNzOicgKyBjb2RlYyk7XG4gICAgICAvLyBpZiBwbGF5bGlzdCBkb2VzIG5vdCBzcGVjaWZ5IGNvZGVjcywgdXNlIGNvZGVjcyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50XG4gICAgICBpZihhdWRpb0NvZGVjID09PSB1bmRlZmluZWQgfHwgZGF0YS5hdWRpb2NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXVkaW9Db2RlYyA9IGRhdGEuYXVkaW9Db2RlYztcbiAgICAgIH1cbiAgICAgIGlmKHZpZGVvQ29kZWMgPT09IHVuZGVmaW5lZCAgfHwgZGF0YS52aWRlb2NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICAgIH1cbiAgICAgIC8vIGluIGNhc2Ugc2V2ZXJhbCBhdWRpbyBjb2RlY3MgbWlnaHQgYmUgdXNlZCwgZm9yY2UgSEUtQUFDIGZvciBhdWRpbyAoc29tZSBicm93c2VycyBkb24ndCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaClcbiAgICAgIC8vZG9uJ3QgZG8gaXQgZm9yIG1vbm8gc3RyZWFtcyAuLi5cbiAgICAgIGlmKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCAmJiBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID09PSAyICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhbmRyb2lkJykgPT09IC0xICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgIH1cbiAgICAgIGlmKCF0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IHt9O1xuICAgICAgICBsb2dnZXIubG9nKGBzZWxlY3RlZCBBL1YgY29kZWNzIGZvciBzb3VyY2VCdWZmZXJzOiR7YXVkaW9Db2RlY30sJHt2aWRlb0NvZGVjfWApO1xuICAgICAgICAvLyBjcmVhdGUgc291cmNlIEJ1ZmZlciBhbmQgbGluayB0aGVtIHRvIE1lZGlhU291cmNlXG4gICAgICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHthdWRpb0NvZGVjfWApO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9XG4gICAgICAgIGlmKHZpZGVvQ29kZWMpIHtcbiAgICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLnZpZGVvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHt2aWRlb0NvZGVjfWApO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZihhdWRpb0NvZGVjKSB7XG4gICAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiAnYXVkaW8nLCBkYXRhIDogZGF0YS5hdWRpb01vb3Z9KTtcbiAgICAgIH1cbiAgICAgIGlmKHZpZGVvQ29kZWMpIHtcbiAgICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6ICd2aWRlbycsIGRhdGEgOiBkYXRhLnZpZGVvTW9vdn0pO1xuICAgICAgfVxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdtZW50UGFyc2luZyhldmVudCxkYXRhKSB7XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gdGhpcy5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnRwYXJzZTIgPSBEYXRlLm5vdygpO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgICBpZihsZXZlbC5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdmFyIGZyYWdtZW50cyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmRldGFpbHMuZnJhZ21lbnRzO1xuICAgICAgICB2YXIgc24wID0gZnJhZ21lbnRzWzBdLnNuLHNuMSA9IGZyYWdtZW50c1tmcmFnbWVudHMubGVuZ3RoLTFdLnNuLCBzbiA9IHRoaXMuZnJhZy5zbjtcbiAgICAgICAgLy9yZXRyaWV2ZSB0aGlzLmZyYWcuc24gaW4gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF1cbiAgICAgICAgaWYoc24gPj0gc24wICYmIHNuIDw9IHNuMSkge1xuICAgICAgICAgIGxldmVsLmRldGFpbHMuc2xpZGluZyA9IGRhdGEuc3RhcnRQVFMgLSBmcmFnbWVudHNbc24tc24wXS5zdGFydDtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coYGxpdmUgcGxheWxpc3Qgc2xpZGluZzoke2xldmVsLmRldGFpbHMuc2xpZGluZy50b0ZpeGVkKDMpfWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsb2dnZXIubG9nKGAgICAgICBwYXJzZWQgZGF0YSwgdHlwZS9zdGFydFBUUy9lbmRQVFMvc3RhcnREVFMvZW5kRFRTL25iOiR7ZGF0YS50eXBlfS8ke2RhdGEuc3RhcnRQVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZFBUUy50b0ZpeGVkKDMpfS8ke2RhdGEuc3RhcnREVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZERUUy50b0ZpeGVkKDMpfS8ke2RhdGEubmJ9YCk7XG4gICAgICAvL3RoaXMuZnJhZy5kcmlmdD1kYXRhLnN0YXJ0UFRTLXRoaXMuZnJhZy5zdGFydDtcbiAgICAgIHRoaXMuZnJhZy5kcmlmdD0wO1xuICAgICAgLy8gaWYobGV2ZWwuZGV0YWlscy5zbGlkaW5nKSB7XG4gICAgICAvLyAgIHRoaXMuZnJhZy5kcmlmdC09bGV2ZWwuZGV0YWlscy5zbGlkaW5nO1xuICAgICAgLy8gfVxuICAgICAgLy9sb2dnZXIubG9nKGAgICAgICBkcmlmdDoke3RoaXMuZnJhZy5kcmlmdC50b0ZpeGVkKDMpfWApO1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6IGRhdGEudHlwZSwgZGF0YSA6IGRhdGEubW9vZn0pO1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6IGRhdGEudHlwZSwgZGF0YSA6IGRhdGEubWRhdH0pO1xuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gZGF0YS5lbmRQVFM7XG4gICAgICB0aGlzLmJ1ZmZlclJhbmdlLnB1c2goe3R5cGUgOiBkYXRhLnR5cGUsIHN0YXJ0IDogZGF0YS5zdGFydFBUUywgZW5kIDogZGF0YS5lbmRQVFMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgIC8vIGlmKGRhdGEudHlwZSA9PT0gJ3ZpZGVvJykge1xuICAgICAgLy8gICB0aGlzLmZyYWcuZnBzRXhwZWN0ZWQgPSAoZGF0YS5uYi0xKSAvIChkYXRhLmVuZFBUUyAtIGRhdGEuc3RhcnRQVFMpO1xuICAgICAgLy8gfVxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLndhcm4oYG5vdCBpbiBQQVJTSU5HIHN0YXRlLCBkaXNjYXJkaW5nICR7ZXZlbnR9YCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnbWVudFBhcnNlZCgpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSB0aGlzLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLlBBUlNFRDtcbiAgICAgIHRoaXMuc3RhdHMudHBhcnNlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRXJyb3IoZXZlbnQsZGF0YSkge1xuICAgIHN3aXRjaChkYXRhLmRldGFpbHMpIHtcbiAgICAgIC8vIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgb24gZXJyb3JzXG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgICAgLy8gaWYgZmF0YWwgZXJyb3IsIHN0b3AgcHJvY2Vzc2luZywgb3RoZXJ3aXNlIG1vdmUgdG8gSURMRSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGxvZ2dlci53YXJuKGBidWZmZXIgY29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHdoaWxlIGxvYWRpbmcgZnJhZyxzd2l0Y2ggdG8gJHtkYXRhLmZhdGFsID8gJ0VSUk9SJyA6ICdJRExFJ30gc3RhdGUgLi4uYCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBkYXRhLmZhdGFsID8gdGhpcy5FUlJPUiA6IHRoaXMuSURMRTtcbiAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZCgpIHtcbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICBpZih0aGlzLnN0YXRlID09PSB0aGlzLkFQUEVORElORyAmJiB0aGlzLm1wNHNlZ21lbnRzLmxlbmd0aCA9PT0gMCkgIHtcbiAgICAgIGlmKHRoaXMuZnJhZykge1xuICAgICAgICB0aGlzLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwgeyBzdGF0cyA6IHRoaXMuc3RhdHMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlckVycm9yKGV2ZW50KSB7XG4gICAgICBsb2dnZXIuZXJyb3IoYHNvdXJjZUJ1ZmZlciBlcnJvcjoke2V2ZW50fWApO1xuICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuRVJST1I7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19BUFBFTkRJTkdfRVJST1IsIGZhdGFsOnRydWUsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCdWZmZXJDb250cm9sbGVyO1xuIiwiLypcbiAqIGxldmVsIGNvbnRyb2xsZXJcbiAqXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4gaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4gaW1wb3J0IHtFcnJvclR5cGVzLEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIExldmVsQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbm1sID0gdGhpcy5vbk1hbmlmZXN0TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZscCA9IHRoaXMub25GcmFnbWVudExvYWRQcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25lcnIgPSB0aGlzLm9uRXJyb3IuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHRoaXMub25mbHApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywgdGhpcy5vbmZscCk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRVJST1IsIHRoaXMub25lcnIpO1xuICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICB9XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSAtMTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBsZXZlbHMgPSBbXSxiaXRyYXRlU3RhcnQsaSxiaXRyYXRlU2V0PXt9O1xuICAgIGRhdGEubGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgdmFyIHJlZHVuZGFudExldmVsSWQgPSBiaXRyYXRlU2V0W2xldmVsLmJpdHJhdGVdO1xuICAgICAgaWYocmVkdW5kYW50TGV2ZWxJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSBsZXZlbHMubGVuZ3RoO1xuICAgICAgICBsZXZlbC51cmwgPSBbbGV2ZWwudXJsXTtcbiAgICAgICAgbGV2ZWwudXJsSWQgPSAwO1xuICAgICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHNbcmVkdW5kYW50TGV2ZWxJZF0udXJsLnB1c2gobGV2ZWwudXJsKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBzdGFydCBiaXRyYXRlIGlzIHRoZSBmaXJzdCBiaXRyYXRlIG9mIHRoZSBtYW5pZmVzdFxuICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgIC8vIHNvcnQgbGV2ZWwgb24gYml0cmF0ZVxuICAgIGxldmVscy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYS5iaXRyYXRlLWIuYml0cmF0ZTtcbiAgICB9KTtcbiAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG5cbiAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICBmb3IoaT0wOyBpIDwgbGV2ZWxzLmxlbmd0aCA7IGkrKykge1xuICAgICAgaWYobGV2ZWxzW2ldLmJpdHJhdGUgPT09IGJpdHJhdGVTdGFydCkge1xuICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgbWFuaWZlc3QgbG9hZGVkLCR7bGV2ZWxzLmxlbmd0aH0gbGV2ZWwocykgZm91bmQsIGZpcnN0IGJpdHJhdGU6JHtiaXRyYXRlU3RhcnR9YCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCxcbiAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiB0aGlzLl9sZXZlbHMsXG4gICAgICAgICAgICAgICAgICAgICAgZmlyc3RMZXZlbCA6IHRoaXMuX2ZpcnN0TGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiBkYXRhLnN0YXRzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVscztcbiAgfVxuXG4gIGdldCBsZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWw7XG4gIH1cblxuICBzZXQgbGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBpZih0aGlzLl9sZXZlbCAhPT0gbmV3TGV2ZWwgfHwgdGhpcy5fbGV2ZWxzW25ld0xldmVsXS5kZXRhaWxzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCk7XG4gICAgfVxuICB9XG5cbiBzZXRMZXZlbEludGVybmFsKG5ld0xldmVsKSB7XG4gICAgLy8gY2hlY2sgaWYgbGV2ZWwgaWR4IGlzIHZhbGlkXG4gICAgaWYobmV3TGV2ZWwgPj0gMCAmJiBuZXdMZXZlbCA8IHRoaXMuX2xldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgaWYodGhpcy50aW1lcikge1xuICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICB9XG4gICAgICB0aGlzLl9sZXZlbCA9IG5ld0xldmVsO1xuICAgICAgbG9nZ2VyLmxvZyhgc3dpdGNoaW5nIHRvIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX1NXSVRDSCwgeyBsZXZlbCA6IG5ld0xldmVsfSk7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdO1xuICAgICAgIC8vIGNoZWNrIGlmIHdlIG5lZWQgdG8gbG9hZCBwbGF5bGlzdCBmb3IgdGhpcyBsZXZlbFxuICAgICAgaWYobGV2ZWwuZGV0YWlscyA9PT0gdW5kZWZpbmVkIHx8IGxldmVsLmRldGFpbHMubGl2ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBsZXZlbCBub3QgcmV0cmlldmVkIHlldCwgb3IgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIChyZSlsb2FkIGl0XG4gICAgICAgIGxvZ2dlci5sb2coYChyZSlsb2FkaW5nIHBsYXlsaXN0IGZvciBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgICB2YXIgdXJsSWQgPSBsZXZlbC51cmxJZDtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7IHVybCA6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsIDogbmV3TGV2ZWwsIGlkIDogdXJsSWR9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW52YWxpZCBsZXZlbCBpZCBnaXZlbiwgdHJpZ2dlciBlcnJvclxuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwgeyB0eXBlIDogRXJyb3JUeXBlcy5PVEhFUl9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkxFVkVMX1NXSVRDSF9FUlJPUiwgbGV2ZWwgOiBuZXdMZXZlbCwgZmF0YWw6ZmFsc2UsIHJlYXNvbjogJ2ludmFsaWQgbGV2ZWwgaWR4J30pO1xuICAgIH1cbiB9XG5cblxuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICB9XG5cbiAgc2V0IG1hbnVhbExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICBpZihuZXdMZXZlbCAhPT0tMSkge1xuICAgICAgdGhpcy5sZXZlbCA9IG5ld0xldmVsO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gIH1cblxuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIGlmKHRoaXMuX3N0YXJ0TGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGFydExldmVsO1xuICAgIH1cbiAgfVxuXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgb25GcmFnbWVudExvYWRQcm9ncmVzcyhldmVudCxkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICBpZihzdGF0cy5hYm9ydGVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubGFzdGZldGNoZHVyYXRpb24gPSAobmV3IERhdGUoKSAtIHN0YXRzLnRyZXF1ZXN0KS8xMDAwO1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgIHRoaXMubGFzdGJ3ID0gc3RhdHMubG9hZGVkKjgvdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbjtcbiAgICAgIC8vY29uc29sZS5sb2coYGZldGNoRHVyYXRpb246JHt0aGlzLmxhc3RmZXRjaGR1cmF0aW9ufSxidzokeyh0aGlzLmxhc3Ridy8xMDAwKS50b0ZpeGVkKDApfS8ke3N0YXRzLmFib3J0ZWR9YCk7XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihldmVudCxkYXRhKSB7XG4gICAgdmFyIGRldGFpbHMgPSBkYXRhLmRldGFpbHMsbGV2ZWxJZCxsZXZlbDtcbiAgICAvLyB0cnkgdG8gcmVjb3ZlciBub3QgZmF0YWwgZXJyb3JzXG4gICAgc3dpdGNoKGRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1I6XG4gICAgICAgICBsZXZlbElkID0gZGF0YS5mcmFnLmxldmVsO1xuICAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUOlxuICAgICAgICBsZXZlbElkID0gZGF0YS5sZXZlbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLyogdHJ5IHRvIHN3aXRjaCB0byBhIHJlZHVuZGFudCBzdHJlYW0gaWYgYW55IGF2YWlsYWJsZS5cbiAgICAgKiBpZiBubyByZWR1bmRhbnQgc3RyZWFtIGF2YWlsYWJsZSwgZW1lcmdlbmN5IHN3aXRjaCBkb3duIChpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IDApXG4gICAgICogb3RoZXJ3aXNlLCB3ZSBjYW5ub3QgcmVjb3ZlciB0aGlzIG5ldHdvcmsgZXJyb3IgLi4uLlxuICAgICAqL1xuICAgIGlmKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF07XG4gICAgICBpZihsZXZlbC51cmxJZCA8IGxldmVsLnVybC5sZW5ndGgtMSkge1xuICAgICAgICBsZXZlbC51cmxJZCsrO1xuICAgICAgICBsZXZlbC5kZXRhaWxzID0gdW5kZWZpbmVkO1xuICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9IGZvciBsZXZlbCAke2xldmVsSWR9OiBzd2l0Y2hpbmcgdG8gcmVkdW5kYW50IHN0cmVhbSBpZCAke2xldmVsLnVybElkfWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gd2UgY291bGQgdHJ5IHRvIHJlY292ZXIgaWYgaW4gYXV0byBtb2RlIGFuZCBjdXJyZW50IGxldmVsIG5vdCBsb3dlc3QgbGV2ZWwgKDApXG4gICAgICAgIGxldCByZWNvdmVyYWJsZSA9ICgodGhpcy5fbWFudWFsTGV2ZWwgPT09IC0xKSAmJiBsZXZlbElkKTtcbiAgICAgICAgaWYocmVjb3ZlcmFibGUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9OiBlbWVyZ2VuY3kgc3dpdGNoLWRvd24gZm9yIG5leHQgZnJhZ21lbnRgKTtcbiAgICAgICAgICB0aGlzLmxhc3RidyA9IDA7XG4gICAgICAgICAgdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbiA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBjYW5ub3QgcmVjb3ZlciAke2RldGFpbHN9IGVycm9yYCk7XG4gICAgICAgICAgdGhpcy5fbGV2ZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICAgICAgaWYodGhpcy50aW1lcikge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoZXZlbnQsZGF0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY3VycmVudCBwbGF5bGlzdCBpcyBhIGxpdmUgcGxheWxpc3RcbiAgICBpZihkYXRhLmRldGFpbHMubGl2ZSAmJiAhdGhpcy50aW1lcikge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCB3ZSB3aWxsIGhhdmUgdG8gcmVsb2FkIGl0IHBlcmlvZGljYWxseVxuICAgICAgLy8gc2V0IHJlbG9hZCBwZXJpb2QgdG8gcGxheWxpc3QgdGFyZ2V0IGR1cmF0aW9uXG4gICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMDAqZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHZhciBsZXZlbElkID0gdGhpcy5fbGV2ZWw7XG4gICAgaWYobGV2ZWxJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF0sIHVybElkID0gbGV2ZWwudXJsSWQ7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHsgdXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbCA6IGxldmVsSWQsIGlkIDogdXJsSWQgfSk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExvYWRMZXZlbCgpIHtcbiAgICBpZih0aGlzLl9tYW51YWxMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICByZXR1cm4gdGhpcy5uZXh0QXV0b0xldmVsKCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dEF1dG9MZXZlbCgpIHtcbiAgICB2YXIgbGFzdGJ3ID0gdGhpcy5sYXN0YncsYWRqdXN0ZWRidyxpLG1heEF1dG9MZXZlbDtcbiAgICBpZih0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID09PSAtMSkge1xuICAgICAgbWF4QXV0b0xldmVsID0gdGhpcy5fbGV2ZWxzLmxlbmd0aC0xO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICAgIH1cbiAgICAvLyBmb2xsb3cgYWxnb3JpdGhtIGNhcHR1cmVkIGZyb20gc3RhZ2VmcmlnaHQgOlxuICAgIC8vIGh0dHBzOi8vYW5kcm9pZC5nb29nbGVzb3VyY2UuY29tL3BsYXRmb3JtL2ZyYW1ld29ya3MvYXYvKy9tYXN0ZXIvbWVkaWEvbGlic3RhZ2VmcmlnaHQvaHR0cGxpdmUvTGl2ZVNlc3Npb24uY3BwXG4gICAgLy8gUGljayB0aGUgaGlnaGVzdCBiYW5kd2lkdGggc3RyZWFtIGJlbG93IG9yIGVxdWFsIHRvIGVzdGltYXRlZCBiYW5kd2lkdGguXG4gICAgZm9yKGkgPTA7IGkgPD0gbWF4QXV0b0xldmVsIDsgaSsrKSB7XG4gICAgLy8gY29uc2lkZXIgb25seSA4MCUgb2YgdGhlIGF2YWlsYWJsZSBiYW5kd2lkdGgsIGJ1dCBpZiB3ZSBhcmUgc3dpdGNoaW5nIHVwLFxuICAgIC8vIGJlIGV2ZW4gbW9yZSBjb25zZXJ2YXRpdmUgKDcwJSkgdG8gYXZvaWQgb3ZlcmVzdGltYXRpbmcgYW5kIGltbWVkaWF0ZWx5XG4gICAgLy8gc3dpdGNoaW5nIGJhY2suXG4gICAgICBpZihpIDw9IHRoaXMuX2xldmVsKSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjgqbGFzdGJ3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuNypsYXN0Ync7XG4gICAgICB9XG4gICAgICBpZihhZGp1c3RlZGJ3IDwgdGhpcy5fbGV2ZWxzW2ldLmJpdHJhdGUpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsaS0xKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGktMTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbENvbnRyb2xsZXI7XG4iLCIgaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IFRTRGVtdXhlciAgICAgICAgICAgIGZyb20gJy4vdHNkZW11eGVyJztcbiBpbXBvcnQgVFNEZW11eGVyV29ya2VyICAgICAgZnJvbSAnLi90c2RlbXV4ZXJ3b3JrZXInO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4gaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cblxuY2xhc3MgRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgaWYoY29uZmlnLmVuYWJsZVdvcmtlciAmJiAodHlwZW9mKFdvcmtlcikgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICBsb2dnZXIubG9nKCdUUyBkZW11eGluZyBpbiB3ZWJ3b3JrZXInKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgd29yayA9IHJlcXVpcmUoJ3dlYndvcmtpZnknKTtcbiAgICAgICAgICB0aGlzLncgPSB3b3JrKFRTRGVtdXhlcldvcmtlcik7XG4gICAgICAgICAgdGhpcy5vbndtc2cgPSB0aGlzLm9uV29ya2VyTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIHRoaXMudy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdpbml0J30pO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcignZXJyb3Igd2hpbGUgaW5pdGlhbGl6aW5nIFRTRGVtdXhlcldvcmtlciwgZmFsbGJhY2sgb24gcmVndWxhciBUU0RlbXV4ZXInKTtcbiAgICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmKHRoaXMudykge1xuICAgICAgdGhpcy53LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLHRoaXMub253bXNnKTtcbiAgICAgIHRoaXMudy50ZXJtaW5hdGUoKTtcbiAgICAgIHRoaXMudyA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIGR1cmF0aW9uKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2UoeyBjbWQgOiAnZGVtdXgnICwgZGF0YSA6IGRhdGEsIGF1ZGlvQ29kZWMgOiBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjOiB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0IDogdGltZU9mZnNldCwgY2M6IGNjLCBsZXZlbCA6IGxldmVsLCBkdXJhdGlvbiA6IGR1cmF0aW9ufSxbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBkdXJhdGlvbik7XG4gICAgICB0aGlzLmRlbXV4ZXIuZW5kKCk7XG4gICAgfVxuICB9XG5cbiAgb25Xb3JrZXJNZXNzYWdlKGV2KSB7XG4gICAgLy9jb25zb2xlLmxvZygnb25Xb3JrZXJNZXNzYWdlOicgKyBldi5kYXRhLmV2ZW50KTtcbiAgICBzd2l0Y2goZXYuZGF0YS5ldmVudCkge1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UOlxuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIGlmKGV2LmRhdGEuYXVkaW9Nb292KSB7XG4gICAgICAgICAgb2JqLmF1ZGlvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEuYXVkaW9Nb292KTtcbiAgICAgICAgICBvYmouYXVkaW9Db2RlYyA9IGV2LmRhdGEuYXVkaW9Db2RlYztcbiAgICAgICAgICBvYmouYXVkaW9DaGFubmVsQ291bnQgPSBldi5kYXRhLmF1ZGlvQ2hhbm5lbENvdW50O1xuICAgICAgICB9XG4gICAgICAgIGlmKGV2LmRhdGEudmlkZW9Nb292KSB7XG4gICAgICAgICAgb2JqLnZpZGVvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEudmlkZW9Nb292KTtcbiAgICAgICAgICBvYmoudmlkZW9Db2RlYyA9IGV2LmRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgICBvYmoudmlkZW9XaWR0aCA9IGV2LmRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgICBvYmoudmlkZW9IZWlnaHQgPSBldi5kYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBOlxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgICAgICBtb29mIDogbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5tb29mKSxcbiAgICAgICAgICBtZGF0IDogbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5tZGF0KSxcbiAgICAgICAgICBzdGFydFBUUyA6IGV2LmRhdGEuc3RhcnRQVFMsXG4gICAgICAgICAgZW5kUFRTIDogZXYuZGF0YS5lbmRQVFMsXG4gICAgICAgICAgc3RhcnREVFMgOiBldi5kYXRhLnN0YXJ0RFRTLFxuICAgICAgICAgIGVuZERUUyA6IGV2LmRhdGEuZW5kRFRTLFxuICAgICAgICAgIHR5cGUgOiBldi5kYXRhLnR5cGUsXG4gICAgICAgICAgbmIgOiBldi5kYXRhLm5iXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoZXYuZGF0YS5ldmVudCxldi5kYXRhLmRhdGEpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXI7XG4iLCIvKipcbiAqIFBhcnNlciBmb3IgZXhwb25lbnRpYWwgR29sb21iIGNvZGVzLCBhIHZhcmlhYmxlLWJpdHdpZHRoIG51bWJlciBlbmNvZGluZ1xuICogc2NoZW1lIHVzZWQgYnkgaDI2NC5cbiAqL1xuXG5pbXBvcnQge2xvZ2dlcn0gICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV4cEdvbG9tYiB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgLy8gdGhlIG51bWJlciBvZiBieXRlcyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhpcy5kYXRhXG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIC8vIHRoZSBjdXJyZW50IHdvcmQgYmVpbmcgZXhhbWluZWRcbiAgICB0aGlzLndvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aCAtIHRoaXMuYnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy5ieXRlc0F2YWlsYWJsZSk7XG5cbiAgICBpZiAoYXZhaWxhYmxlQnl0ZXMgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbm8gYnl0ZXMgYXZhaWxhYmxlJyk7XG4gICAgfVxuXG4gICAgd29ya2luZ0J5dGVzLnNldCh0aGlzLmRhdGEuc3ViYXJyYXkocG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbiArIGF2YWlsYWJsZUJ5dGVzKSk7XG4gICAgdGhpcy53b3JkID0gbmV3IERhdGFWaWV3KHdvcmtpbmdCeXRlcy5idWZmZXIpLmdldFVpbnQzMigwKTtcblxuICAgIC8vIHRyYWNrIHRoZSBhbW91bnQgb2YgdGhpcy5kYXRhIHRoYXQgaGFzIGJlZW4gcHJvY2Vzc2VkXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlID0gYXZhaWxhYmxlQnl0ZXMgKiA4O1xuICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gYXZhaWxhYmxlQnl0ZXM7XG4gIH1cblxuICAvLyAoY291bnQ6aW50KTp2b2lkXG4gIHNraXBCaXRzKGNvdW50KSB7XG4gICAgdmFyIHNraXBCeXRlczsgLy8gOmludFxuICAgIGlmICh0aGlzLmJpdHNBdmFpbGFibGUgPiBjb3VudCkge1xuICAgICAgdGhpcy53b3JkICAgICAgICAgIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9IGVsc2Uge1xuICAgICAgY291bnQgLT0gdGhpcy5iaXRzQXZhaWxhYmxlO1xuICAgICAgc2tpcEJ5dGVzID0gY291bnQgPj4gMztcblxuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gc2tpcEJ5dGVzO1xuXG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG5cbiAgICAgIHRoaXMud29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfVxuICB9XG5cbiAgLy8gKHNpemU6aW50KTp1aW50XG4gIHJlYWRCaXRzKHNpemUpIHtcbiAgICB2YXJcbiAgICAgIGJpdHMgPSBNYXRoLm1pbih0aGlzLmJpdHNBdmFpbGFibGUsIHNpemUpLCAvLyA6dWludFxuICAgICAgdmFsdSA9IHRoaXMud29yZCA+Pj4gKDMyIC0gYml0cyk7IC8vIDp1aW50XG5cbiAgICBpZihzaXplID4zMikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDYW5ub3QgcmVhZCBtb3JlIHRoYW4gMzIgYml0cyBhdCBhIHRpbWUnKTtcbiAgICB9XG5cbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy5ieXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG5cbiAgICBiaXRzID0gc2l6ZSAtIGJpdHM7XG4gICAgaWYgKGJpdHMgPiAwKSB7XG4gICAgICByZXR1cm4gdmFsdSA8PCBiaXRzIHwgdGhpcy5yZWFkQml0cyhiaXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbHU7XG4gICAgfVxuICB9XG5cbiAgLy8gKCk6dWludFxuICBza2lwTFooKSB7XG4gICAgdmFyIGxlYWRpbmdaZXJvQ291bnQ7IC8vIDp1aW50XG4gICAgZm9yIChsZWFkaW5nWmVyb0NvdW50ID0gMCA7IGxlYWRpbmdaZXJvQ291bnQgPCB0aGlzLmJpdHNBdmFpbGFibGUgOyArK2xlYWRpbmdaZXJvQ291bnQpIHtcbiAgICAgIGlmICgwICE9PSAodGhpcy53b3JkICYgKDB4ODAwMDAwMDAgPj4+IGxlYWRpbmdaZXJvQ291bnQpKSkge1xuICAgICAgICAvLyB0aGUgZmlyc3QgYml0IG9mIHdvcmtpbmcgd29yZCBpcyAxXG4gICAgICAgIHRoaXMud29yZCA8PD0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMWigpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwVUVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVRUcoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExaKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFRygpIHtcbiAgICB2YXIgdmFsdSA9IHRoaXMucmVhZFVFRygpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVCeXRlKCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIEV4cEdvbG9tYiBkZWNvZGVyIHBhc3QgYSBzY2FsaW5nIGxpc3QuIFRoZSBzY2FsaW5nXG4gICAqIGxpc3QgaXMgb3B0aW9uYWxseSB0cmFuc21pdHRlZCBhcyBwYXJ0IG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyXG4gICAqIHNldCBhbmQgaXMgbm90IHJlbGV2YW50IHRvIHRyYW5zbXV4aW5nLlxuICAgKiBAcGFyYW0gY291bnQge251bWJlcn0gdGhlIG51bWJlciBvZiBlbnRyaWVzIGluIHRoaXMgc2NhbGluZyBsaXN0XG4gICAqIEBzZWUgUmVjb21tZW5kYXRpb24gSVRVLVQgSC4yNjQsIFNlY3Rpb24gNy4zLjIuMS4xLjFcbiAgICovXG4gIHNraXBTY2FsaW5nTGlzdChjb3VudCkge1xuICAgIHZhclxuICAgICAgbGFzdFNjYWxlID0gOCxcbiAgICAgIG5leHRTY2FsZSA9IDgsXG4gICAgICBqLFxuICAgICAgZGVsdGFTY2FsZTtcblxuICAgIGZvciAoaiA9IDA7IGogPCBjb3VudDsgaisrKSB7XG4gICAgICBpZiAobmV4dFNjYWxlICE9PSAwKSB7XG4gICAgICAgIGRlbHRhU2NhbGUgPSB0aGlzLnJlYWRFRygpO1xuICAgICAgICBuZXh0U2NhbGUgPSAobGFzdFNjYWxlICsgZGVsdGFTY2FsZSArIDI1NikgJSAyNTY7XG4gICAgICB9XG5cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNQUygpIHtcbiAgICB2YXJcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IDAsXG4gICAgICBwcm9maWxlSWRjLHByb2ZpbGVDb21wYXQsbGV2ZWxJZGMsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuXG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy8gcHJvZmlsZV9pZGNcbiAgICBwcm9maWxlQ29tcGF0ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy9sZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuXG4gICAgLy8gc29tZSBwcm9maWxlcyBoYXZlIG1vcmUgb3B0aW9uYWwgZGF0YSB3ZSBkb24ndCBuZWVkXG4gICAgaWYgKHByb2ZpbGVJZGMgPT09IDEwMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMTAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTIyIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDE0NCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgaWYgKGNocm9tYUZvcm1hdElkYyA9PT0gMykge1xuICAgICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBzZXBhcmF0ZV9jb2xvdXJfcGxhbmVfZmxhZ1xuICAgICAgfVxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9sdW1hX21pbnVzOFxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIGxvZzJfbWF4X2ZyYW1lX251bV9taW51czRcbiAgICB2YXIgcGljT3JkZXJDbnRUeXBlID0gdGhpcy5yZWFkVUVHKCk7XG5cbiAgICBpZiAocGljT3JkZXJDbnRUeXBlID09PSAwKSB7XG4gICAgICB0aGlzLnJlYWRVRUcoKTsgLy9sb2cyX21heF9waWNfb3JkZXJfY250X2xzYl9taW51czRcbiAgICB9IGVsc2UgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMSkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGVsdGFfcGljX29yZGVyX2Fsd2F5c196ZXJvX2ZsYWdcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3Jfbm9uX3JlZl9waWNcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfdG9wX3RvX2JvdHRvbV9maWVsZFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGU7IGkrKykge1xuICAgICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3JlZl9mcmFtZVsgaSBdXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIG1heF9udW1fcmVmX2ZyYW1lc1xuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGdhcHNfaW5fZnJhbWVfbnVtX3ZhbHVlX2FsbG93ZWRfZmxhZ1xuXG4gICAgcGljV2lkdGhJbk1ic01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcblxuICAgIGZyYW1lTWJzT25seUZsYWcgPSB0aGlzLnJlYWRCaXRzKDEpO1xuICAgIGlmIChmcmFtZU1ic09ubHlGbGFnID09PSAwKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBtYl9hZGFwdGl2ZV9mcmFtZV9maWVsZF9mbGFnXG4gICAgfVxuXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGlyZWN0Xzh4OF9pbmZlcmVuY2VfZmxhZ1xuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gZnJhbWVfY3JvcHBpbmdfZmxhZ1xuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHByb2ZpbGVJZGMgOiBwcm9maWxlSWRjLFxuICAgICAgcHJvZmlsZUNvbXBhdCA6IHByb2ZpbGVDb21wYXQsXG4gICAgICBsZXZlbElkYyA6IGxldmVsSWRjLFxuICAgICAgd2lkdGg6ICgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIsXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtIChmcmFtZUNyb3BUb3BPZmZzZXQgKiAyKSAtIChmcmFtZUNyb3BCb3R0b21PZmZzZXQgKiAyKVxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhwR29sb21iO1xuIiwiLyoqXG4gKiBBIHN0cmVhbS1iYXNlZCBtcDJ0cyB0byBtcDQgY29udmVydGVyLiBUaGlzIHV0aWxpdHkgaXMgdXNlZCB0b1xuICogZGVsaXZlciBtcDRzIHRvIGEgU291cmNlQnVmZmVyIG9uIHBsYXRmb3JtcyB0aGF0IHN1cHBvcnQgbmF0aXZlXG4gKiBNZWRpYSBTb3VyY2UgRXh0ZW5zaW9ucy5cbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBFeHBHb2xvbWIgICAgICAgZnJvbSAnLi9leHAtZ29sb21iJztcbi8vIGltcG9ydCBIZXggICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvaGV4JztcbiBpbXBvcnQgTVA0ICAgICAgICAgICAgIGZyb20gJy4uL3JlbXV4L21wNC1nZW5lcmF0b3InO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbiBpbXBvcnQge0Vycm9yVHlwZXMsRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgVFNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmxhc3RDQyA9IDA7XG4gICAgdGhpcy5QRVNfVElNRVNDQUxFPTkwMDAwO1xuICAgIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SPTQ7XG4gICAgdGhpcy5NUDRfVElNRVNDQUxFPXRoaXMuUEVTX1RJTUVTQ0FMRS90aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMucG10UGFyc2VkID0gZmFsc2U7XG4gICAgdGhpcy5fcG10SWQgPSB0aGlzLl9hdmNJZCA9IHRoaXMuX2FhY0lkID0gLTE7XG4gICAgdGhpcy5fYXZjVHJhY2sgPSB7dHlwZSA6ICd2aWRlbycsIHNlcXVlbmNlTnVtYmVyIDogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7dHlwZSA6ICdhdWRpbycsIHNlcXVlbmNlTnVtYmVyIDogMH07XG4gICAgdGhpcy5fYXZjU2FtcGxlcyA9IFtdO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgPSAwO1xuICAgIHRoaXMuX2FhY1NhbXBsZXMgPSBbXTtcbiAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gZmFsc2U7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsdGltZU9mZnNldCxjYyxsZXZlbCxkdXJhdGlvbikge1xuICAgIHZhciBhdmNEYXRhLGFhY0RhdGEsc3RhcnQsbGVuID0gZGF0YS5sZW5ndGgsc3R0LHBpZCxhdGYsb2Zmc2V0O1xuICAgIHRoaXMuYXVkaW9Db2RlYyA9IGF1ZGlvQ29kZWM7XG4gICAgdGhpcy52aWRlb0NvZGVjID0gdmlkZW9Db2RlYztcbiAgICB0aGlzLnRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICAgIHRoaXMuX2R1cmF0aW9uID0gZHVyYXRpb247XG4gICAgaWYoY2MgIT09IHRoaXMubGFzdENDKSB7XG4gICAgICBsb2dnZXIubG9nKGBkaXNjb250aW51aXR5IGRldGVjdGVkYCk7XG4gICAgICB0aGlzLmluc2VydERpc2NvbnRpbnVpdHkoKTtcbiAgICAgIHRoaXMubGFzdENDID0gY2M7XG4gICAgfSBlbHNlIGlmKGxldmVsICE9PSB0aGlzLmxhc3RMZXZlbCkge1xuICAgICAgbG9nZ2VyLmxvZyhgbGV2ZWwgc3dpdGNoIGRldGVjdGVkYCk7XG4gICAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgICB0aGlzLmxhc3RMZXZlbCA9IGxldmVsO1xuICAgIH1cbiAgICB2YXIgcG10UGFyc2VkPXRoaXMucG10UGFyc2VkLGF2Y0lkPXRoaXMuX2F2Y0lkLGFhY0lkPXRoaXMuX2FhY0lkO1xuXG4gICAgLy8gbG9vcCB0aHJvdWdoIFRTIHBhY2tldHNcbiAgICBmb3Ioc3RhcnQgPSAwOyBzdGFydCA8IGxlbiA7IHN0YXJ0ICs9IDE4OCkge1xuICAgICAgaWYoZGF0YVtzdGFydF0gPT09IDB4NDcpIHtcbiAgICAgICAgc3R0ID0gISEoZGF0YVtzdGFydCsxXSAmIDB4NDApO1xuICAgICAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIFRTWzFdXG4gICAgICAgIHBpZCA9ICgoZGF0YVtzdGFydCsxXSAmIDB4MWYpIDw8IDgpICsgZGF0YVtzdGFydCsyXTtcbiAgICAgICAgYXRmID0gKGRhdGFbc3RhcnQrM10gJiAweDMwKSA+PiA0O1xuICAgICAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGUgZmlmdGggYnl0ZSBvZiB0aGUgVFMgcGFja2V0IGhlYWRlci5cbiAgICAgICAgaWYoYXRmID4gMSkge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0KzUrZGF0YVtzdGFydCs0XTtcbiAgICAgICAgICAvLyBjb250aW51ZSBpZiB0aGVyZSBpcyBvbmx5IGFkYXB0YXRpb24gZmllbGRcbiAgICAgICAgICBpZihvZmZzZXQgPT09IChzdGFydCsxODgpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2Zmc2V0ID0gc3RhcnQrNDtcbiAgICAgICAgfVxuICAgICAgICBpZihwbXRQYXJzZWQpIHtcbiAgICAgICAgICBpZihwaWQgPT09IGF2Y0lkKSB7XG4gICAgICAgICAgICBpZihzdHQpIHtcbiAgICAgICAgICAgICAgaWYoYXZjRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhdmNEYXRhID0ge2RhdGE6IFtdLHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoYXZjRGF0YSkge1xuICAgICAgICAgICAgICBhdmNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCxzdGFydCsxODgpKTtcbiAgICAgICAgICAgICAgYXZjRGF0YS5zaXplKz1zdGFydCsxODgtb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZihwaWQgPT09IGFhY0lkKSB7XG4gICAgICAgICAgICBpZihzdHQpIHtcbiAgICAgICAgICAgICAgaWYoYWFjRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhYWNEYXRhID0ge2RhdGE6IFtdLHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoYWFjRGF0YSkge1xuICAgICAgICAgICAgICBhYWNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCxzdGFydCsxODgpKTtcbiAgICAgICAgICAgICAgYWFjRGF0YS5zaXplKz1zdGFydCsxODgtb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZihzdHQpIHtcbiAgICAgICAgICAgIG9mZnNldCArPSBkYXRhW29mZnNldF0gKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZihwaWQgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUEFUKGRhdGEsb2Zmc2V0KTtcbiAgICAgICAgICB9IGVsc2UgaWYocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQTVQoZGF0YSxvZmZzZXQpO1xuICAgICAgICAgICAgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQgPSB0cnVlO1xuICAgICAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNJZDtcbiAgICAgICAgICAgIGFhY0lkID0gdGhpcy5fYWFjSWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6ZmFsc2UsIHJlYXNvbiA6ICdUUyBwYWNrZXQgZGlkIG5vdCBzdGFydCB3aXRoIDB4NDcnfSk7XG4gICAgICB9XG4gICAgfVxuICAvLyBwYXJzZSBsYXN0IFBFUyBwYWNrZXRcbiAgICBpZihhdmNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgfVxuICAgIGlmKGFhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICB9XG4gIH1cblxuICBlbmQoKSB7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmKCF0aGlzLl9pbml0U2VnR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLl9nZW5lcmF0ZUluaXRTZWdtZW50KCk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQVZDIHNhbXBsZXM6JyArIHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKTtcbiAgICBpZih0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBVkNTYW1wbGVzKCk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQUFDIHNhbXBsZXM6JyArIHRoaXMuX2FhY1NhbXBsZXMubGVuZ3RoKTtcbiAgICBpZih0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBQUNTYW1wbGVzKCk7XG4gICAgfVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNFRCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VQQVQoZGF0YSxvZmZzZXQpIHtcbiAgICAvLyBza2lwIHRoZSBQU0kgaGVhZGVyIGFuZCBwYXJzZSB0aGUgZmlyc3QgUE1UIGVudHJ5XG4gICAgdGhpcy5fcG10SWQgID0gKGRhdGFbb2Zmc2V0KzEwXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCsxMV07XG4gICAgLy9sb2dnZXIubG9nKCdQTVQgUElEOicgICsgdGhpcy5fcG10SWQpO1xuICB9XG5cbiAgX3BhcnNlUE1UKGRhdGEsb2Zmc2V0KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsdGFibGVFbmQscHJvZ3JhbUluZm9MZW5ndGgscGlkO1xuICAgIHNlY3Rpb25MZW5ndGggPSAoZGF0YVtvZmZzZXQrMV0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQrMl07XG4gICAgdGFibGVFbmQgPSBvZmZzZXQgKyAzICsgc2VjdGlvbkxlbmd0aCAtIDQ7XG4gICAgLy8gdG8gZGV0ZXJtaW5lIHdoZXJlIHRoZSB0YWJsZSBpcywgd2UgaGF2ZSB0byBmaWd1cmUgb3V0IGhvd1xuICAgIC8vIGxvbmcgdGhlIHByb2dyYW0gaW5mbyBkZXNjcmlwdG9ycyBhcmVcbiAgICBwcm9ncmFtSW5mb0xlbmd0aCA9IChkYXRhW29mZnNldCsxMF0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQrMTFdO1xuXG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCArPSAxMiArIHByb2dyYW1JbmZvTGVuZ3RoO1xuICAgIHdoaWxlIChvZmZzZXQgPCB0YWJsZUVuZCkge1xuICAgICAgcGlkID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgIHN3aXRjaChkYXRhW29mZnNldF0pIHtcbiAgICAgICAgLy8gSVNPL0lFQyAxMzgxOC03IEFEVFMgQUFDIChNUEVHLTIgbG93ZXIgYml0LXJhdGUgYXVkaW8pXG4gICAgICAgIGNhc2UgMHgwZjpcbiAgICAgICAgLy9sb2dnZXIubG9nKCdBQUMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hYWNJZCA9IHBpZDtcbiAgICAgICAgICB0aGlzLl9hYWNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vIElUVS1UIFJlYy4gSC4yNjQgYW5kIElTTy9JRUMgMTQ0OTYtMTAgKGxvd2VyIGJpdC1yYXRlIHZpZGVvKVxuICAgICAgICBjYXNlIDB4MWI6XG4gICAgICAgIC8vbG9nZ2VyLmxvZygnQVZDIFBJRDonICArIHBpZCk7XG4gICAgICAgIHRoaXMuX2F2Y0lkID0gcGlkO1xuICAgICAgICB0aGlzLl9hdmNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxvZ2dlci5sb2coJ3Vua293biBzdHJlYW0gdHlwZTonICArIGRhdGFbb2Zmc2V0XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSB0byB0aGUgbmV4dCB0YWJsZSBlbnRyeVxuICAgICAgLy8gc2tpcCBwYXN0IHRoZSBlbGVtZW50YXJ5IHN0cmVhbSBkZXNjcmlwdG9ycywgaWYgcHJlc2VudFxuICAgICAgb2Zmc2V0ICs9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MEYpIDw8IDggfCBkYXRhW29mZnNldCArIDRdKSArIDU7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEVTKHN0cmVhbSkge1xuICAgIHZhciBpID0gMCxmcmFnLHBlc0ZsYWdzLHBlc1ByZWZpeCxwZXNMZW4scGVzSGRyTGVuLHBlc0RhdGEscGVzUHRzLHBlc0R0cyxwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgLy9yZXRyaWV2ZSBQVFMvRFRTIGZyb20gZmlyc3QgZnJhZ21lbnRcbiAgICBmcmFnID0gc3RyZWFtLmRhdGFbMF07XG4gICAgcGVzUHJlZml4ID0gKGZyYWdbMF0gPDwgMTYpICsgKGZyYWdbMV0gPDwgOCkgKyBmcmFnWzJdO1xuICAgIGlmKHBlc1ByZWZpeCA9PT0gMSkge1xuICAgICAgcGVzTGVuID0gKGZyYWdbNF0gPDwgOCkgKyBmcmFnWzVdO1xuICAgICAgcGVzRmxhZ3MgPSBmcmFnWzddO1xuICAgICAgaWYgKHBlc0ZsYWdzICYgMHhDMCkge1xuICAgICAgICAvKiBQRVMgaGVhZGVyIGRlc2NyaWJlZCBoZXJlIDogaHR0cDovL2R2ZC5zb3VyY2Vmb3JnZS5uZXQvZHZkaW5mby9wZXMtaGRyLmh0bWxcbiAgICAgICAgICAgIGFzIFBUUyAvIERUUyBpcyAzMyBiaXQgd2UgY2Fubm90IHVzZSBiaXR3aXNlIG9wZXJhdG9yIGluIEpTLFxuICAgICAgICAgICAgYXMgQml0d2lzZSBvcGVyYXRvcnMgdHJlYXQgdGhlaXIgb3BlcmFuZHMgYXMgYSBzZXF1ZW5jZSBvZiAzMiBiaXRzICovXG4gICAgICAgIHBlc1B0cyA9IChmcmFnWzldICYgMHgwRSkqNTM2ODcwOTEyICsvLyAxIDw8IDI5XG4gICAgICAgICAgKGZyYWdbMTBdICYgMHhGRikqNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgIChmcmFnWzExXSAmIDB4RkUpKjE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgKGZyYWdbMTJdICYgMHhGRikqMTI4ICsvLyAxIDw8IDdcbiAgICAgICAgICAoZnJhZ1sxM10gJiAweEZFKS8yO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc1B0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgICAgLy8gZGVjcmVtZW50IDJeMzNcbiAgICAgICAgICAgICAgcGVzUHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICBpZiAocGVzRmxhZ3MgJiAweDQwKSB7XG4gICAgICAgICAgcGVzRHRzID0gKGZyYWdbMTRdICYgMHgwRSApKjUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgICAgKGZyYWdbMTVdICYgMHhGRiApKjQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAgIChmcmFnWzE2XSAmIDB4RkUgKSoxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgICAgKGZyYWdbMTddICYgMHhGRiApKjEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgICAoZnJhZ1sxOF0gJiAweEZFICkvMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNEdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICAgIHBlc0R0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZXNEdHMgPSBwZXNQdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlc0hkckxlbiA9IGZyYWdbOF07XG4gICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSBwZXNIZHJMZW4rOTtcbiAgICAgIC8vIHRyaW0gUEVTIGhlYWRlclxuICAgICAgc3RyZWFtLmRhdGFbMF0gPSBzdHJlYW0uZGF0YVswXS5zdWJhcnJheShwYXlsb2FkU3RhcnRPZmZzZXQpO1xuICAgICAgc3RyZWFtLnNpemUgLT0gcGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgICAgLy9yZWFzc2VtYmxlIFBFUyBwYWNrZXRcbiAgICAgIHBlc0RhdGEgPSBuZXcgVWludDhBcnJheShzdHJlYW0uc2l6ZSk7XG4gICAgICAvLyByZWFzc2VtYmxlIHRoZSBwYWNrZXRcbiAgICAgIHdoaWxlIChzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgZnJhZyA9IHN0cmVhbS5kYXRhLnNoaWZ0KCk7XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpICs9IGZyYWcuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IGRhdGEgOiBwZXNEYXRhLCBwdHMgOiBwZXNQdHMsIGR0cyA6IHBlc0R0cywgbGVuIDogcGVzTGVufTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlQVZDUEVTKHBlcykge1xuICAgIHZhciB1bml0cyx0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLGF2Y1NhbXBsZSxrZXkgPSBmYWxzZTtcbiAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSk7XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdW5pdHMudW5pdHMuZm9yRWFjaCh1bml0ID0+IHtcbiAgICAgIHN3aXRjaCh1bml0LnR5cGUpIHtcbiAgICAgICAgLy9JRFJcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgIGtleSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU1BTXG4gICAgICAgIGNhc2UgNzpcbiAgICAgICAgICBpZighdHJhY2suc3BzKSB7XG4gICAgICAgICAgICB2YXIgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcbiAgICAgICAgICAgIHZhciBjb25maWcgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRTUFMoKTtcbiAgICAgICAgICAgIHRyYWNrLndpZHRoID0gY29uZmlnLndpZHRoO1xuICAgICAgICAgICAgdHJhY2suaGVpZ2h0ID0gY29uZmlnLmhlaWdodDtcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVJZGMgPSBjb25maWcucHJvZmlsZUlkYztcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXQgPSBjb25maWcucHJvZmlsZUNvbXBhdDtcbiAgICAgICAgICAgIHRyYWNrLmxldmVsSWRjID0gY29uZmlnLmxldmVsSWRjO1xuICAgICAgICAgICAgdHJhY2suc3BzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgICB0cmFjay50aW1lc2NhbGUgPSB0aGlzLk1QNF9USU1FU0NBTEU7XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMuTVA0X1RJTUVTQ0FMRSp0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgICAgIHZhciBjb2RlY2FycmF5ID0gdW5pdC5kYXRhLnN1YmFycmF5KDEsNCk7XG4gICAgICAgICAgICB2YXIgY29kZWNzdHJpbmcgID0gJ2F2YzEuJztcbiAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICAgIGlmIChoLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGVjc3RyaW5nICs9IGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFjay5jb2RlYyA9IGNvZGVjc3RyaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9QUFNcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgIGlmKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvL2J1aWxkIHNhbXBsZSBmcm9tIFBFU1xuICAgIC8vIEFubmV4IEIgdG8gTVA0IGNvbnZlcnNpb24gdG8gYmUgZG9uZVxuICAgIGF2Y1NhbXBsZSA9IHsgdW5pdHMgOiB1bml0cywgcHRzIDogcGVzLnB0cywgZHRzIDogcGVzLmR0cyAsIGtleSA6IGtleX07XG4gICAgdGhpcy5fYXZjU2FtcGxlcy5wdXNoKGF2Y1NhbXBsZSk7XG4gICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCArPSB1bml0cy5sZW5ndGg7XG4gICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSArPSB1bml0cy51bml0cy5sZW5ndGg7XG4gIH1cblxuXG4gIF9mbHVzaEFWQ1NhbXBsZXMoKSB7XG4gICAgdmFyIHZpZXcsaT04LGF2Y1NhbXBsZSxtcDRTYW1wbGUsbXA0U2FtcGxlTGVuZ3RoLHVuaXQsdHJhY2sgPSB0aGlzLl9hdmNUcmFjayxcbiAgICAgICAgbGFzdFNhbXBsZURUUyxtZGF0LG1vb2YsZmlyc3RQVFMsZmlyc3REVFMscHRzLGR0cyxwdHNub3JtLGR0c25vcm0sc2FtcGxlcyA9IFtdO1xuXG4gICAgLyogY29uY2F0ZW5hdGUgdGhlIHZpZGVvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtcGRhdCB0eXBlKSAqL1xuICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoICsgKDQgKiB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1KSs4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsNCk7XG4gICAgd2hpbGUodGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGF2Y1NhbXBsZSA9IHRoaXMuX2F2Y1NhbXBsZXMuc2hpZnQoKTtcbiAgICAgIG1wNFNhbXBsZUxlbmd0aCA9IDA7XG5cbiAgICAgIC8vIGNvbnZlcnQgTkFMVSBiaXRzdHJlYW0gdG8gTVA0IGZvcm1hdCAocHJlcGVuZCBOQUxVIHdpdGggc2l6ZSBmaWVsZClcbiAgICAgIHdoaWxlKGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgpIHtcbiAgICAgICAgdW5pdCA9IGF2Y1NhbXBsZS51bml0cy51bml0cy5zaGlmdCgpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMihpLCB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIGkgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBpKTtcbiAgICAgICAgaSArPSB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoKz00K3VuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgICAgcHRzID0gYXZjU2FtcGxlLnB0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICBkdHMgPSBhdmNTYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIC8vbG9nZ2VyLmxvZygnVmlkZW8vUFRTL0RUUzonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMpO1xuXG4gICAgICBpZihsYXN0U2FtcGxlRFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsbGFzdFNhbXBsZURUUyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLGxhc3RTYW1wbGVEVFMpO1xuXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdFNhbXBsZURUUykvdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gICAgICAgIGlmKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsdGhpcy5uZXh0QXZjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsdGhpcy5uZXh0QXZjUHRzKTtcbiAgICAgICAgLy8gY2hlY2sgaWYgZnJhZ21lbnRzIGFyZSBjb250aWd1b3VzIChpLmUuIG5vIG1pc3NpbmcgZnJhbWVzIGJldHdlZW4gZnJhZ21lbnQpXG4gICAgICAgIGlmKHRoaXMubmV4dEF2Y1B0cykge1xuICAgICAgICAgIHZhciBkZWx0YSA9IE1hdGgucm91bmQoKHB0c25vcm0gLSB0aGlzLm5leHRBdmNQdHMpLzkwKSxhYnNkZWx0YT1NYXRoLmFicyhkZWx0YSk7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYnNkZWx0YS9hdmNTYW1wbGUucHRzOicgKyBhYnNkZWx0YSArICcvJyArIGF2Y1NhbXBsZS5wdHMpO1xuICAgICAgICAgIC8vIGlmIGRlbHRhIGlzIGxlc3MgdGhhbiAzMDAgbXMsIG5leHQgbG9hZGVkIGZyYWdtZW50IGlzIGFzc3VtZWQgdG8gYmUgY29udGlndW91cyB3aXRoIGxhc3Qgb25lXG4gICAgICAgICAgaWYoYWJzZGVsdGEgPCAzMDApIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnVmlkZW8gbmV4dCBQVFM6JyArIHRoaXMubmV4dEF2Y1B0cyk7XG4gICAgICAgICAgICBpZihkZWx0YSA+IDEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7ZGVsdGF9IG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzokeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IFBUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IHRoaXMubmV4dEF2Y1B0cztcbiAgICAgICAgICAgIC8vIG9mZnNldCBEVFMgYXMgd2VsbCwgZW5zdXJlIHRoYXQgRFRTIGlzIHNtYWxsZXIgb3IgZXF1YWwgdGhhbiBuZXcgUFRTXG4gICAgICAgICAgICBkdHNub3JtID0gTWF0aC5tYXgoZHRzbm9ybS1kZWx0YSwgdGhpcy5sYXN0QXZjRHRzKTtcbiAgICAgICAgICAgLy8gbG9nZ2VyLmxvZygnVmlkZW8vUFRTL0RUUyBhZGp1c3RlZDonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vdCBjb250aWd1b3VzIHRpbWVzdGFtcCwgY2hlY2sgaWYgUFRTIGlzIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgICAgICB2YXIgZXhwZWN0ZWRQVFMgPSB0aGlzLlBFU19USU1FU0NBTEUqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYW55IHVuZXhwZWN0ZWQgZHJpZnQgYmV0d2VlbiBleHBlY3RlZCB0aW1lc3RhbXAgYW5kIHJlYWwgb25lXG4gICAgICAgICAgICBpZihNYXRoLmFicyhleHBlY3RlZFBUUyAtIHB0c25vcm0pID4gdGhpcy5QRVNfVElNRVNDQUxFKjM2MDAgKSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgUFRTIGxvb3BpbmcgPz8/IEFWQyBQVFMgZGVsdGE6JHtleHBlY3RlZFBUUy1wdHNub3JtfWApO1xuICAgICAgICAgICAgICB2YXIgcHRzT2Zmc2V0ID0gZXhwZWN0ZWRQVFMtcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IGV4cGVjdGVkIFBUUztcbiAgICAgICAgICAgICAgcHRzbm9ybSA9IGV4cGVjdGVkUFRTO1xuICAgICAgICAgICAgICBkdHNub3JtID0gcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gb2Zmc2V0IGluaXRQVFMvaW5pdERUUyB0byBmaXggY29tcHV0YXRpb24gZm9yIGZvbGxvd2luZyBzYW1wbGVzXG4gICAgICAgICAgICAgIHRoaXMuX2luaXRQVFMtPXB0c09mZnNldDtcbiAgICAgICAgICAgICAgdGhpcy5faW5pdERUUy09cHRzT2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGF2Y1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAscHRzbm9ybSk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCxkdHNub3JtKTtcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2coYFBUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthdmNTYW1wbGUucHRzfS8ke2F2Y1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGF2Y1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX1gKTtcblxuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgIGR1cmF0aW9uIDogMCxcbiAgICAgICAgY3RzOiAocHRzbm9ybSAtIGR0c25vcm0pL3RoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRQcmlvOiAwXG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGlmKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMTtcbiAgICAgIH1cbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdFNhbXBsZURUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIGlmKHNhbXBsZXMubGVuZ3RoID49Mikge1xuICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gc2FtcGxlc1tzYW1wbGVzLmxlbmd0aC0yXS5kdXJhdGlvbjtcbiAgICB9XG4gICAgdGhpcy5sYXN0QXZjRHRzID0gZHRzbm9ybTtcbiAgICAvLyBuZXh0IEFWQyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgIHRoaXMubmV4dEF2Y1B0cyA9IHB0c25vcm0gKyBtcDRTYW1wbGUuZHVyYXRpb24qdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gICAgLy9sb2dnZXIubG9nKCdWaWRlby9sYXN0QXZjRHRzL25leHRBdmNQdHM6JyArIHRoaXMubGFzdEF2Y0R0cyArICcvJyArIHRoaXMubmV4dEF2Y1B0cyk7XG5cbiAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1ID0gMDtcblxuICAgIHRyYWNrLnNhbXBsZXMgPSBzYW1wbGVzO1xuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLGZpcnN0RFRTL3RoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICBtb29mOiBtb29mLFxuICAgICAgbWRhdDogbWRhdCxcbiAgICAgIHN0YXJ0UFRTIDogZmlyc3RQVFMvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgZW5kUFRTIDogdGhpcy5uZXh0QXZjUHRzL3RoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIHN0YXJ0RFRTIDogZmlyc3REVFMvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgZW5kRFRTIDogKGR0c25vcm0gKyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUiptcDRTYW1wbGUuZHVyYXRpb24pL3RoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIHR5cGUgOiAndmlkZW8nLFxuICAgICAgbmIgOiBzYW1wbGVzLmxlbmd0aFxuICAgIH0pO1xuICB9XG5cbiAgX3BhcnNlQVZDTkFMdShhcnJheSkge1xuICAgIHZhciBpID0gMCxsZW4gPSBhcnJheS5ieXRlTGVuZ3RoLHZhbHVlLG92ZXJmbG93LHN0YXRlID0gMDtcbiAgICB2YXIgdW5pdHMgPSBbXSwgdW5pdCwgdW5pdFR5cGUsIGxhc3RVbml0U3RhcnQsbGFzdFVuaXRUeXBlLGxlbmd0aCA9IDA7XG4gICAgLy9sb2dnZXIubG9nKCdQRVM6JyArIEhleC5oZXhEdW1wKGFycmF5KSk7XG5cbiAgICB3aGlsZShpPCBsZW4pIHtcbiAgICAgIHZhbHVlID0gYXJyYXlbaSsrXTtcbiAgICAgIC8vIGZpbmRpbmcgMyBvciA0LWJ5dGUgc3RhcnQgY29kZXMgKDAwIDAwIDAxIE9SIDAwIDAwIDAwIDAxKVxuICAgICAgc3dpdGNoKHN0YXRlKSB7XG4gICAgICAgIGNhc2UgMDpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIGlmKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmKHZhbHVlID09PSAxKSB7XG4gICAgICAgICAgICB1bml0VHlwZSA9IGFycmF5W2ldICYgMHgxZjtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBOQUxVIEAgb2Zmc2V0OicgKyBpICsgJyx0eXBlOicgKyB1bml0VHlwZSk7XG4gICAgICAgICAgICBpZihsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICAgICAgICAgIHVuaXQgPSB7IGRhdGEgOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LGktc3RhdGUtMSksIHR5cGUgOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgICAgICAgICBsZW5ndGgrPWktc3RhdGUtMS1sYXN0VW5pdFN0YXJ0O1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiBOQUwgdW5pdHMgYXJlIG5vdCBzdGFydGluZyByaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGFja2V0LCBwdXNoIHByZWNlZGluZyBkYXRhIGludG8gcHJldmlvdXMgTkFMIHVuaXQuXG4gICAgICAgICAgICAgIG92ZXJmbG93ICA9IGkgLSBzdGF0ZSAtIDE7XG4gICAgICAgICAgICAgIGlmIChvdmVyZmxvdykge1xuICAgICAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaXJzdCBOQUxVIGZvdW5kIHdpdGggb3ZlcmZsb3c6JyArIG92ZXJmbG93KTtcbiAgICAgICAgICAgICAgICAgIGlmKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBsYXN0YXZjU2FtcGxlID0gdGhpcy5fYXZjU2FtcGxlc1t0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aC0xXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxhc3RVbml0ID0gbGFzdGF2Y1NhbXBsZS51bml0cy51bml0c1tsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLmxlbmd0aC0xXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCtvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICAgIHRtcC5zZXQobGFzdFVuaXQuZGF0YSwwKTtcbiAgICAgICAgICAgICAgICAgICAgdG1wLnNldChhcnJheS5zdWJhcnJheSgwLG92ZXJmbG93KSxsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgICAgICAgICAgICAgICBsYXN0YXZjU2FtcGxlLnVuaXRzLmxlbmd0aCs9b3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGgrPW92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0VW5pdFN0YXJ0ID0gaTtcbiAgICAgICAgICAgIGxhc3RVbml0VHlwZSA9IHVuaXRUeXBlO1xuICAgICAgICAgICAgaWYodW5pdFR5cGUgPT09IDEgfHwgdW5pdFR5cGUgPT09IDUpIHtcbiAgICAgICAgICAgICAgLy8gT1BUSSAhISEgaWYgSURSL05EUiB1bml0LCBjb25zaWRlciBpdCBpcyBsYXN0IE5BTHVcbiAgICAgICAgICAgICAgaSA9IGxlbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHsgZGF0YSA6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsbGVuKSwgdHlwZSA6IGxhc3RVbml0VHlwZX07XG4gICAgICBsZW5ndGgrPWxlbi1sYXN0VW5pdFN0YXJ0O1xuICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgdW5pdHMgOiB1bml0cyAsIGxlbmd0aCA6IGxlbmd0aH07XG4gIH1cblxuICBfUFRTTm9ybWFsaXplKHZhbHVlLHJlZmVyZW5jZSkge1xuICAgIHZhciBvZmZzZXQ7XG4gICAgaWYgKHJlZmVyZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChyZWZlcmVuY2UgPCB2YWx1ZSkge1xuICAgICAgICAvLyAtIDJeMzNcbiAgICAgICAgb2Zmc2V0ID0gLTg1ODk5MzQ1OTI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gKyAyXjMzXG4gICAgICAgIG9mZnNldCA9IDg1ODk5MzQ1OTI7XG4gICAgfVxuICAgIC8qIFBUUyBpcyAzM2JpdCAoZnJvbSAwIHRvIDJeMzMgLTEpXG4gICAgICBpZiBkaWZmIGJldHdlZW4gdmFsdWUgYW5kIHJlZmVyZW5jZSBpcyBiaWdnZXIgdGhhbiBoYWxmIG9mIHRoZSBhbXBsaXR1ZGUgKDJeMzIpIHRoZW4gaXQgbWVhbnMgdGhhdFxuICAgICAgUFRTIGxvb3Bpbmcgb2NjdXJlZC4gZmlsbCB0aGUgZ2FwICovXG4gICAgd2hpbGUgKE1hdGguYWJzKHZhbHVlIC0gcmVmZXJlbmNlKSA+IDQyOTQ5NjcyOTYpIHtcbiAgICAgICAgdmFsdWUgKz0gb2Zmc2V0O1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICBfcGFyc2VBQUNQRVMocGVzKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssYWFjU2FtcGxlLGRhdGEgPSBwZXMuZGF0YSxjb25maWcsYWR0c0ZyYW1lU2l6ZSxhZHRzU3RhcnRPZmZzZXQsYWR0c0hlYWRlckxlbixzdGFtcCxuYlNhbXBsZXMsbGVuO1xuICAgIGlmKHRoaXMuYWFjT3ZlckZsb3cpIHtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheSh0aGlzLmFhY092ZXJGbG93LmJ5dGVMZW5ndGgrZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQodGhpcy5hYWNPdmVyRmxvdywwKTtcbiAgICAgIHRtcC5zZXQoZGF0YSx0aGlzLmFhY092ZXJGbG93LmJ5dGVMZW5ndGgpO1xuICAgICAgZGF0YSA9IHRtcDtcbiAgICB9XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IoYWR0c1N0YXJ0T2Zmc2V0ID0gMCwgbGVuID0gZGF0YS5sZW5ndGg7IGFkdHNTdGFydE9mZnNldDxsZW4tMTsgYWR0c1N0YXJ0T2Zmc2V0KyspIHtcbiAgICAgIGlmKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW2FkdHNTdGFydE9mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmKGFkdHNTdGFydE9mZnNldCkge1xuICAgICAgdmFyIHJlYXNvbixmYXRhbDtcbiAgICAgIGlmKGFkdHNTdGFydE9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke2FkdHNTdGFydE9mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gYG5vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVNgO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6ZmF0YWwsIHJlYXNvbiA6IHJlYXNvbn0pO1xuICAgICAgaWYoZmF0YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgIGNvbmZpZyA9IHRoaXMuX0FEVFN0b0F1ZGlvQ29uZmlnKGRhdGEsYWR0c1N0YXJ0T2Zmc2V0LHRoaXMuYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay50aW1lc2NhbGUgPSB0aGlzLk1QNF9USU1FU0NBTEU7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMuTVA0X1RJTUVTQ0FMRSp0aGlzLl9kdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCAgIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIG5iU2FtcGxlcyA9IDA7XG4gICAgd2hpbGUoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgbGVuKSB7XG4gICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCszXSAmIDB4MDMpIDw8IDExKTtcbiAgICAgIC8vIGJ5dGUgNFxuICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoZGF0YVthZHRzU3RhcnRPZmZzZXQrNF0gPDwgMyk7XG4gICAgICAvLyBieXRlIDVcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKChkYXRhW2FkdHNTdGFydE9mZnNldCs1XSAmIDB4RTApID4+PiA1KTtcbiAgICAgIGFkdHNIZWFkZXJMZW4gPSAoISEoZGF0YVthZHRzU3RhcnRPZmZzZXQrMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIGFkdHNGcmFtZVNpemUgLT0gYWR0c0hlYWRlckxlbjtcbiAgICAgIHN0YW1wID0gTWF0aC5yb3VuZChwZXMucHRzICsgbmJTYW1wbGVzKjEwMjQqdGhpcy5QRVNfVElNRVNDQUxFL3RyYWNrLmF1ZGlvc2FtcGxlcmF0ZSk7XG4gICAgICAvL3N0YW1wID0gcGVzLnB0cztcbiAgICAgIC8vY29uc29sZS5sb2coJ0FBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC9wdHM6JyArIChhZHRzU3RhcnRPZmZzZXQrNykgKyAnLycgKyBhZHRzRnJhbWVTaXplICsgJy8nICsgc3RhbXAudG9GaXhlZCgwKSk7XG4gICAgICBpZihhZHRzU3RhcnRPZmZzZXQrYWR0c0hlYWRlckxlbithZHRzRnJhbWVTaXplIDw9IGxlbikge1xuICAgICAgICBhYWNTYW1wbGUgPSB7IHVuaXQgOiBkYXRhLnN1YmFycmF5KGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuLGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuK2FkdHNGcmFtZVNpemUpICwgcHRzIDogc3RhbXAsIGR0cyA6IHN0YW1wfTtcbiAgICAgICAgdGhpcy5fYWFjU2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggKz0gYWR0c0ZyYW1lU2l6ZTtcbiAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0Kz1hZHRzRnJhbWVTaXplK2FkdHNIZWFkZXJMZW47XG4gICAgICAgIG5iU2FtcGxlcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGFkdHNTdGFydE9mZnNldCA8IGxlbikge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0LGxlbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9mbHVzaEFBQ1NhbXBsZXMoKSB7XG4gICAgdmFyIHZpZXcsaT04LGFhY1NhbXBsZSxtcDRTYW1wbGUsdW5pdCx0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBsYXN0U2FtcGxlRFRTLG1kYXQsbW9vZixmaXJzdFBUUyxmaXJzdERUUyxwdHMsZHRzLHB0c25vcm0sZHRzbm9ybSxzYW1wbGVzID0gW107XG5cbiAgICAvKiBjb25jYXRlbmF0ZSB0aGUgYXVkaW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1wZGF0IHR5cGUpICovXG4gICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRoaXMuX2FhY1NhbXBsZXNMZW5ndGgrOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCxtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LDQpO1xuICAgIHdoaWxlKHRoaXMuX2FhY1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhYWNTYW1wbGUgPSB0aGlzLl9hYWNTYW1wbGVzLnNoaWZ0KCk7XG4gICAgICB1bml0ID0gYWFjU2FtcGxlLnVuaXQ7XG4gICAgICBtZGF0LnNldCh1bml0LCBpKTtcbiAgICAgIGkgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuXG4gICAgICBwdHMgPSBhYWNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGFhY1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuXG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUzonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApKTtcbiAgICAgIGlmKGxhc3RTYW1wbGVEVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cyxsYXN0U2FtcGxlRFRTKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsbGFzdFNhbXBsZURUUyk7XG4gICAgICAgIC8vIHdlIHVzZSBEVFMgdG8gY29tcHV0ZSBzYW1wbGUgZHVyYXRpb24sIGJ1dCB3ZSB1c2UgUFRTIHRvIGNvbXB1dGUgaW5pdFBUUyB3aGljaCBpcyB1c2VkIHRvIHN5bmMgYXVkaW8gYW5kIHZpZGVvXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdFNhbXBsZURUUykvdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gICAgICAgIGlmKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsdGhpcy5uZXh0QWFjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsdGhpcy5uZXh0QWFjUHRzKTtcbiAgICAgICAgLy8gY2hlY2sgaWYgZnJhZ21lbnRzIGFyZSBjb250aWd1b3VzIChpLmUuIG5vIG1pc3NpbmcgZnJhbWVzIGJldHdlZW4gZnJhZ21lbnQpXG4gICAgICAgIGlmKHRoaXMubmV4dEFhY1B0cyAmJiB0aGlzLm5leHRBYWNQdHMgIT09IHB0c25vcm0pIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvIG5leHQgUFRTOicgKyB0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICAgIHZhciBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCoocHRzbm9ybSAtIHRoaXMubmV4dEFhY1B0cykvdGhpcy5QRVNfVElNRVNDQUxFKSxhYnNkZWx0YT1NYXRoLmFicyhkZWx0YSk7XG4gICAgICAgICAgLy8gaWYgZGVsdGEgaXMgbGVzcyB0aGFuIDMwMCBtcywgbmV4dCBsb2FkZWQgZnJhZ21lbnQgaXMgYXNzdW1lZCB0byBiZSBjb250aWd1b3VzIHdpdGggbGFzdCBvbmVcbiAgICAgICAgICBpZihhYnNkZWx0YSA+IDEgJiYgYWJzZGVsdGEgPCAzMDApIHtcbiAgICAgICAgICAgIGlmKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBQUM6JHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4gICAgICAgICAgICAgIC8vIHNldCBQVFMgdG8gbmV4dCBQVFMsIGFuZCBlbnN1cmUgUFRTIGlzIGdyZWF0ZXIgb3IgZXF1YWwgdGhhbiBsYXN0IERUU1xuICAgICAgICAgICAgICBwdHNub3JtID0gTWF0aC5tYXgodGhpcy5uZXh0QWFjUHRzLCB0aGlzLmxhc3RBYWNEdHMpO1xuICAgICAgICAgICAgICBkdHNub3JtID0gcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvRFRTIGFkanVzdGVkOicgKyBhYWNTYW1wbGUucHRzICsgJy8nICsgYWFjU2FtcGxlLmR0cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBQUM6JHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAoYWJzZGVsdGEpIHtcbiAgICAgICAgICAgIC8vIG5vdCBjb250aWd1b3VzIHRpbWVzdGFtcCwgY2hlY2sgaWYgUFRTIGlzIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgICAgICB2YXIgZXhwZWN0ZWRQVFMgPSB0aGlzLlBFU19USU1FU0NBTEUqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBleHBlY3RlZFBUUy9QVFNub3JtOiR7ZXhwZWN0ZWRQVFN9LyR7cHRzbm9ybX0vJHtleHBlY3RlZFBUUy1wdHNub3JtfWApO1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYW55IHVuZXhwZWN0ZWQgZHJpZnQgYmV0d2VlbiBleHBlY3RlZCB0aW1lc3RhbXAgYW5kIHJlYWwgb25lXG4gICAgICAgICAgICBpZihNYXRoLmFicyhleHBlY3RlZFBUUyAtIHB0c25vcm0pID4gdGhpcy5QRVNfVElNRVNDQUxFKjM2MDAgKSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgUFRTIGxvb3BpbmcgPz8/IEFBQyBQVFMgZGVsdGE6JHtleHBlY3RlZFBUUy1wdHNub3JtfWApO1xuICAgICAgICAgICAgICB2YXIgcHRzT2Zmc2V0ID0gZXhwZWN0ZWRQVFMtcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IGV4cGVjdGVkIFBUUztcbiAgICAgICAgICAgICAgcHRzbm9ybSA9IGV4cGVjdGVkUFRTO1xuICAgICAgICAgICAgICBkdHNub3JtID0gcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gb2Zmc2V0IGluaXRQVFMvaW5pdERUUyB0byBmaXggY29tcHV0YXRpb24gZm9yIGZvbGxvd2luZyBzYW1wbGVzXG4gICAgICAgICAgICAgIHRoaXMuX2luaXRQVFMtPXB0c09mZnNldDtcbiAgICAgICAgICAgICAgdGhpcy5faW5pdERUUy09cHRzT2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGFhY1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAscHRzbm9ybSk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCxkdHNub3JtKTtcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2coYFBUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthYWNTYW1wbGUucHRzfS8ke2FhY1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGFhY1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX1gKTtcbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogdW5pdC5ieXRlTGVuZ3RoLFxuICAgICAgICBjdHM6IDAsXG4gICAgICAgIGR1cmF0aW9uOjAsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uIDogMSxcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdFNhbXBsZURUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIC8vc2V0IGxhc3Qgc2FtcGxlIGR1cmF0aW9uIGFzIGJlaW5nIGlkZW50aWNhbCB0byBwcmV2aW91cyBzYW1wbGVcbiAgICBpZihzYW1wbGVzLmxlbmd0aCA+PTIpIHtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGgtMl0uZHVyYXRpb247XG4gICAgfVxuICAgIHRoaXMubGFzdEFhY0R0cyA9IGR0c25vcm07XG4gICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBYWNQdHMgPSBwdHNub3JtICsgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IqbXA0U2FtcGxlLmR1cmF0aW9uO1xuICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8vUFRTL1BUU2VuZDonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApICsgJy8nICsgdGhpcy5uZXh0QWFjRHRzLnRvRml4ZWQoMCkpO1xuXG4gICAgdGhpcy5fYWFjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssZmlyc3REVFMvdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsdHJhY2spO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFMgOiBmaXJzdFBUUy90aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICBlbmRQVFMgOiB0aGlzLm5leHRBYWNQdHMvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgc3RhcnREVFMgOiBmaXJzdERUUy90aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICBlbmREVFMgOiAoZHRzbm9ybSArIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SKm1wNFNhbXBsZS5kdXJhdGlvbikvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgdHlwZSA6ICdhdWRpbycsXG4gICAgICBuYiA6IHNhbXBsZXMubGVuZ3RoXG4gICAgfSk7XG4gIH1cblxuICBfQURUU3RvQXVkaW9Db25maWcoZGF0YSxvZmZzZXQsYXVkaW9Db2RlYykge1xuICAgIHZhciBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNDaGFuZWxDb25maWcsIC8vIDppbnRcbiAgICAgICAgY29uZmlnLFxuICAgICAgICB1c2VyQWdlbnQgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGFkdHNTYW1wbGVpbmdSYXRlcyA9IFtcbiAgICAgICAgICAgIDk2MDAwLCA4ODIwMCxcbiAgICAgICAgICAgIDY0MDAwLCA0ODAwMCxcbiAgICAgICAgICAgIDQ0MTAwLCAzMjAwMCxcbiAgICAgICAgICAgIDI0MDAwLCAyMjA1MCxcbiAgICAgICAgICAgIDE2MDAwLCAxMjAwMFxuICAgICAgICAgIF07XG5cbiAgICAvLyBieXRlIDJcbiAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVtvZmZzZXQrMl0gJiAweEMwKSA+Pj4gNikgKyAxO1xuICAgIGFkdHNTYW1wbGVpbmdJbmRleCA9ICgoZGF0YVtvZmZzZXQrMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgYWR0c0NoYW5lbENvbmZpZyA9ICgoZGF0YVtvZmZzZXQrMl0gJiAweDAxKSA8PCAyKTtcbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVtvZmZzZXQrM10gJiAweEMwKSA+Pj4gNik7XG5cbiAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBjb2RlYzoke2F1ZGlvQ29kZWN9LEFEVFMgZGF0YTp0eXBlOiR7YWR0c09iamVjdFR5cGV9LHNhbXBsZWluZ0luZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fVske2FkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdfWtIel0sY2hhbm5lbENvbmZpZzoke2FkdHNDaGFuZWxDb25maWd9YCk7XG5cblxuICAgIC8vIGZpcmVmb3g6IGZyZXEgbGVzcyB0aGFuIDI0a0h6ID0gQUFDIFNCUiAoSEUtQUFDKVxuICAgIGlmKHVzZXJBZ2VudC5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xKSB7XG4gICAgICBpZihhZHRzU2FtcGxlaW5nSW5kZXggPj02KSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4LTM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgICAgLy8gQW5kcm9pZCA6IGFsd2F5cyB1c2UgQUFDXG4gICAgfSBlbHNlIGlmKHVzZXJBZ2VudC5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qICBmb3Igb3RoZXIgYnJvd3NlcnMgKGNocm9tZSAuLi4pXG4gICAgICAgICAgYWx3YXlzIGZvcmNlIGF1ZGlvIHR5cGUgdG8gYmUgSEUtQUFDIFNCUiwgYXMgc29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2ggcHJvcGVybHkgKGxpa2UgQ2hyb21lIC4uLilcbiAgICAgICovXG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBIRS1BQUMpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIEFORCBmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6KVxuICAgICAgaWYoKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkgfHwgKCFhdWRpb0NvZGVjICYmIGFkdHNTYW1wbGVpbmdJbmRleCA+PTYpKSAge1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgQUFDKSBBTkQgKGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHogT1IgbmIgY2hhbm5lbCBpcyAxKVxuICAgICAgICBpZihhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yJykgIT09LTEgJiYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2IHx8IGFkdHNDaGFuZWxDb25maWcgPT09MSkpIHtcbiAgICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICB9XG4gIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgIElTTyAxNDQ5Ni0zIChBQUMpLnBkZiAtIFRhYmxlIDEuMTMg4oCUIFN5bnRheCBvZiBBdWRpb1NwZWNpZmljQ29uZmlnKClcbiAgICBBdWRpbyBQcm9maWxlIC8gQXVkaW8gT2JqZWN0IFR5cGVcbiAgICAwOiBOdWxsXG4gICAgMTogQUFDIE1haW5cbiAgICAyOiBBQUMgTEMgKExvdyBDb21wbGV4aXR5KVxuICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgIDQ6IEFBQyBMVFAgKExvbmcgVGVybSBQcmVkaWN0aW9uKVxuICAgIDU6IFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbilcbiAgICA2OiBBQUMgU2NhbGFibGVcbiAgIHNhbXBsaW5nIGZyZXFcbiAgICAwOiA5NjAwMCBIelxuICAgIDE6IDg4MjAwIEh6XG4gICAgMjogNjQwMDAgSHpcbiAgICAzOiA0ODAwMCBIelxuICAgIDQ6IDQ0MTAwIEh6XG4gICAgNTogMzIwMDAgSHpcbiAgICA2OiAyNDAwMCBIelxuICAgIDc6IDIyMDUwIEh6XG4gICAgODogMTYwMDAgSHpcbiAgICA5OiAxMjAwMCBIelxuICAgIDEwOiAxMTAyNSBIelxuICAgIDExOiA4MDAwIEh6XG4gICAgMTI6IDczNTAgSHpcbiAgICAxMzogUmVzZXJ2ZWRcbiAgICAxNDogUmVzZXJ2ZWRcbiAgICAxNTogZnJlcXVlbmN5IGlzIHdyaXR0ZW4gZXhwbGljdGx5XG4gICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAwOiBEZWZpbmVkIGluIEFPVCBTcGVjaWZjIENvbmZpZ1xuICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgKi9cbiAgICAvLyBhdWRpb09iamVjdFR5cGUgPSBwcm9maWxlID0+IHByb2ZpbGUsIHRoZSBNUEVHLTQgQXVkaW8gT2JqZWN0IFR5cGUgbWludXMgMVxuICAgIGNvbmZpZ1swXSA9IGFkdHNPYmplY3RUeXBlIDw8IDM7XG4gICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgIGNvbmZpZ1swXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICBjb25maWdbMV0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICBjb25maWdbMV0gfD0gYWR0c0NoYW5lbENvbmZpZyA8PCAzO1xuICAgIGlmKGFkdHNPYmplY3RUeXBlID09PSA1KSB7XG4gICAgICAvLyBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXhcbiAgICAgIGNvbmZpZ1sxXSB8PSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICAgIGNvbmZpZ1syXSA9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgICAgLy8gYWR0c09iamVjdFR5cGUgKGZvcmNlIHRvIDIsIGNocm9tZSBpcyBjaGVja2luZyB0aGF0IG9iamVjdCB0eXBlIGlzIGxlc3MgdGhhbiA1ID8/P1xuICAgICAgLy8gICAgaHR0cHM6Ly9jaHJvbWl1bS5nb29nbGVzb3VyY2UuY29tL2Nocm9taXVtL3NyYy5naXQvKy9tYXN0ZXIvbWVkaWEvZm9ybWF0cy9tcDQvYWFjLmNjXG4gICAgICBjb25maWdbMl0gfD0gMiA8PCAyO1xuICAgICAgY29uZmlnWzNdID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIHsgY29uZmlnIDogY29uZmlnLCBzYW1wbGVyYXRlIDogYWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF0sIGNoYW5uZWxDb3VudCA6IGFkdHNDaGFuZWxDb25maWcsIGNvZGVjIDogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG5cbiAgX2dlbmVyYXRlSW5pdFNlZ21lbnQoKSB7XG4gICAgaWYodGhpcy5fYXZjSWQgPT09IC0xKSB7XG4gICAgICAvL2F1ZGlvIG9ubHlcbiAgICAgIGlmKHRoaXMuX2FhY1RyYWNrLmNvbmZpZykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULHtcbiAgICAgICAgICBhdWRpb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYWFjVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjIDogdGhpcy5fYWFjVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQgOiB0aGlzLl9hYWNUcmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzIC0gdGhpcy5QRVNfVElNRVNDQUxFKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzIC0gdGhpcy5QRVNfVElNRVNDQUxFKnRoaXMudGltZU9mZnNldDtcbiAgICAgIH1cbiAgICB9IGVsc2VcbiAgICBpZih0aGlzLl9hYWNJZCA9PT0gLTEpIHtcbiAgICAgIC8vdmlkZW8gb25seVxuICAgICAgaWYodGhpcy5fYXZjVHJhY2suc3BzICYmIHRoaXMuX2F2Y1RyYWNrLnBwcykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULHtcbiAgICAgICAgICB2aWRlb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYXZjVHJhY2tdKSxcbiAgICAgICAgICB2aWRlb0NvZGVjIDogdGhpcy5fYXZjVHJhY2suY29kZWMsXG4gICAgICAgICAgdmlkZW9XaWR0aCA6IHRoaXMuX2F2Y1RyYWNrLndpZHRoLFxuICAgICAgICAgIHZpZGVvSGVpZ2h0IDogdGhpcy5fYXZjVHJhY2suaGVpZ2h0XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgICAgaWYodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9hdmNTYW1wbGVzWzBdLnB0cyAtIHRoaXMuUEVTX1RJTUVTQ0FMRSp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2F2Y1NhbXBsZXNbMF0uZHRzIC0gdGhpcy5QRVNfVElNRVNDQUxFKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2F1ZGlvIGFuZCB2aWRlb1xuICAgICAgaWYodGhpcy5fYWFjVHJhY2suY29uZmlnICYmIHRoaXMuX2F2Y1RyYWNrLnNwcyAmJiB0aGlzLl9hdmNUcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IHRoaXMuX2FhY1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogdGhpcy5fYWFjVHJhY2suY2hhbm5lbENvdW50LFxuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IE1hdGgubWluKHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzLHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzKSAtIHRoaXMuUEVTX1RJTUVTQ0FMRSp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgdGhpcy5faW5pdERUUyA9IE1hdGgubWluKHRoaXMuX2F2Y1NhbXBsZXNbMF0uZHRzLHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzKSAtIHRoaXMuUEVTX1RJTUVTQ0FMRSp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVFNEZW11eGVyO1xuIiwiIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBUU0RlbXV4ZXIgICAgICAgICAgICBmcm9tICcuLi9kZW11eC90c2RlbXV4ZXInO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG5cbnZhciBUU0RlbXV4ZXJXb3JrZXIgPSBmdW5jdGlvbiAoc2VsZikge1xuICAgIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsZnVuY3Rpb24gKGV2KSB7XG4gICAgICAvL2NvbnNvbGUubG9nKCdkZW11eGVyIGNtZDonICsgZXYuZGF0YS5jbWQpO1xuICAgICAgc3dpdGNoKGV2LmRhdGEuY21kKSB7XG4gICAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZGVtdXgnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGV2LmRhdGEuZGF0YSksIGV2LmRhdGEuYXVkaW9Db2RlYyxldi5kYXRhLnZpZGVvQ29kZWMsIGV2LmRhdGEudGltZU9mZnNldCwgZXYuZGF0YS5jYywgZXYuZGF0YS5sZXZlbCwgZXYuZGF0YS5kdXJhdGlvbik7XG4gICAgICAgICAgc2VsZi5kZW11eGVyLmVuZCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gbGlzdGVuIHRvIGV2ZW50cyB0cmlnZ2VyZWQgYnkgVFMgRGVtdXhlclxuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIGZ1bmN0aW9uKGV2LGRhdGEpIHtcbiAgICAgIHZhciBvYmpEYXRhID0geyBldmVudCA6IGV2IH07XG4gICAgICB2YXIgb2JqVHJhbnNmZXJhYmxlID0gW107XG4gICAgICBpZihkYXRhLmF1ZGlvQ29kZWMpIHtcbiAgICAgICAgb2JqRGF0YS5hdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICBvYmpEYXRhLmF1ZGlvTW9vdiA9IGRhdGEuYXVkaW9Nb292LmJ1ZmZlcjtcbiAgICAgICAgb2JqRGF0YS5hdWRpb0NoYW5uZWxDb3VudCA9IGRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEuYXVkaW9Nb292KTtcbiAgICAgIH1cbiAgICAgIGlmKGRhdGEudmlkZW9Db2RlYykge1xuICAgICAgICBvYmpEYXRhLnZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgICAgIG9iakRhdGEudmlkZW9Nb292ID0gZGF0YS52aWRlb01vb3YuYnVmZmVyO1xuICAgICAgICBvYmpEYXRhLnZpZGVvV2lkdGggPSBkYXRhLnZpZGVvV2lkdGg7XG4gICAgICAgIG9iakRhdGEudmlkZW9IZWlnaHQgPSBkYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICBvYmpUcmFuc2ZlcmFibGUucHVzaChvYmpEYXRhLnZpZGVvTW9vdik7XG4gICAgICB9XG4gICAgICAvLyBwYXNzIG1vb3YgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSxvYmpUcmFuc2ZlcmFibGUpO1xuICAgIH0pO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCBmdW5jdGlvbihldixkYXRhKSB7XG4gICAgICB2YXIgb2JqRGF0YSA9IHsgZXZlbnQgOiBldiAsIHR5cGUgOiBkYXRhLnR5cGUsIHN0YXJ0UFRTIDogZGF0YS5zdGFydFBUUywgZW5kUFRTIDogZGF0YS5lbmRQVFMgLCBzdGFydERUUyA6IGRhdGEuc3RhcnREVFMsIGVuZERUUyA6IGRhdGEuZW5kRFRTICxtb29mIDogZGF0YS5tb29mLmJ1ZmZlciwgbWRhdCA6IGRhdGEubWRhdC5idWZmZXIsIG5iIDogZGF0YS5uYn07XG4gICAgICAvLyBwYXNzIG1vb2YvbWRhdCBkYXRhIGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsW29iakRhdGEubW9vZixvYmpEYXRhLm1kYXRdKTtcbiAgICB9KTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OmV2ZW50fSk7XG4gICAgfSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRVJST1IsIGZ1bmN0aW9uKGV2ZW50LGRhdGEpIHtcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OmV2ZW50LGRhdGE6ZGF0YX0pO1xuICAgIH0pO1xuICB9O1xuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXJXb3JrZXI7XG5cbiIsIlxuZXhwb3J0IHZhciBFcnJvclR5cGVzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG5ldHdvcmsgZXJyb3IgKGxvYWRpbmcgZXJyb3IgLyB0aW1lb3V0IC4uLilcbiAgTkVUV09SS19FUlJPUiA6ICAnaGxzTmV0d29ya0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtZWRpYSBFcnJvciAodmlkZW8vcGFyc2luZy9tZWRpYXNvdXJjZSBlcnJvcilcbiAgTUVESUFfRVJST1IgOiAgJ2hsc01lZGlhRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhbGwgb3RoZXIgZXJyb3JzXG4gIE9USEVSX0VSUk9SIDogICdobHNPdGhlckVycm9yJ1xufTtcblxuZXhwb3J0IHZhciBFcnJvckRldGFpbHMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZCBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfRVJST1IgOiAgJ21hbmlmZXN0TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX1RJTUVPVVQgOiAgJ21hbmlmZXN0TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IHBhcnNpbmcgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfUEFSU0lOR19FUlJPUiA6ICAnbWFuaWZlc3RQYXJzaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9FUlJPUiA6ICAnbGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQgOiAgJ2xldmVsTG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIHN3aXRjaCBlcnJvciAtIGRhdGE6IHsgbGV2ZWwgOiBmYXVsdHkgbGV2ZWwgSWQsIGV2ZW50IDogZXJyb3IgZGVzY3JpcHRpb259XG4gIExFVkVMX1NXSVRDSF9FUlJPUiA6ICAnbGV2ZWxTd2l0Y2hFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBGUkFHX0xPQURfRVJST1IgOiAgJ2ZyYWdMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SIDogICdmcmFnTG9vcExvYWRpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgdGltZW91dCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FEX1RJTUVPVVQgOiAgJ2ZyYWdMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19QQVJTSU5HX0VSUk9SIDogICdmcmFnUGFyc2luZ0Vycm9yJyxcbiAgICAvLyBJZGVudGlmaWVyIGZvciBhIGZyYWdtZW50IGFwcGVuZGluZyBlcnJvciBldmVudCAtIGRhdGE6IGFwcGVuZGluZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0FQUEVORElOR19FUlJPUiA6ICAnZnJhZ0FwcGVuZGluZ0Vycm9yJ1xufTtcbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBzdWNjZXNmdWxseSBhdHRhY2hlZCB0byB2aWRlbyBlbGVtZW50IC0gZGF0YTogeyBtZWRpYVNvdXJjZSB9XG4gIE1TRV9BVFRBQ0hFRCA6ICdobHNNZWRpYVNvdXJjZUF0dGFjaGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBkZXRhY2hlZCBmcm9tIHZpZGVvIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTVNFX0RFVEFDSEVEIDogJ2hsc01lZGlhU291cmNlRGV0YWNoZWQnLFxuICAvLyBmaXJlZCB0byBzaWduYWwgdGhhdCBhIG1hbmlmZXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBtYW5pZmVzdFVSTH1cbiAgTUFOSUZFU1RfTE9BRElORyAgOiAnaGxzTWFuaWZlc3RMb2FkaW5nJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gbG9hZGVkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIHVybCA6IG1hbmlmZXN0VVJMLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfX1cbiAgTUFOSUZFU1RfTE9BREVEICA6ICdobHNNYW5pZmVzdExvYWRlZCcsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIHBhcnNlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCBmaXJzdExldmVsIDogaW5kZXggb2YgZmlyc3QgcXVhbGl0eSBsZXZlbCBhcHBlYXJpbmcgaW4gTWFuaWZlc3R9XG4gIE1BTklGRVNUX1BBUlNFRCAgOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IGxldmVsIFVSTCAgbGV2ZWwgOiBpZCBvZiBsZXZlbCBiZWluZyBsb2FkZWR9XG4gIExFVkVMX0xPQURJTkcgICAgOiAnaGxzTGV2ZWxMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgZmluaXNoZXMgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIGxvYWRlZCBsZXZlbCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX0gfVxuICBMRVZFTF9MT0FERUQgOiAgJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIIDogICdobHNMZXZlbFN3aXRjaCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FESU5HIDogICdobHNGcmFnTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIGlzIHByb2dyZXNzaW5nIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCB7IHRyZXF1ZXN0LCB0Zmlyc3QsIGxvYWRlZH19XG4gIEZSQUdfTE9BRF9QUk9HUkVTUyA6ICAnaGxzRnJhZ0xvYWRQcm9ncmVzcycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgYWJvcnRpbmcgZm9yIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAtIGRhdGE6IHtmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQgOiAgJ2hsc0ZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcGF5bG9hZCA6IGZyYWdtZW50IHBheWxvYWQsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbGVuZ3RofX1cbiAgRlJBR19MT0FERUQgOiAgJ2hsc0ZyYWdMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIEluaXQgU2VnbWVudCBoYXMgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vdiA6IG1vb3YgTVA0IGJveCwgY29kZWNzIDogY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnR9XG4gIEZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQgOiAgJ2hsc0ZyYWdQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIG1vb2YvbWRhdCBoYXZlIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb2YgOiBtb29mIE1QNCBib3gsIG1kYXQgOiBtZGF0IE1QNCBib3h9XG4gIEZSQUdfUEFSU0lOR19EQVRBIDogICdobHNGcmFnUGFyc2luZ0RhdGEnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHBhcnNpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogdW5kZWZpbmVkXG4gIEZSQUdfUEFSU0VEIDogICdobHNGcmFnUGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCByZW11eGVkIE1QNCBib3hlcyBoYXZlIGFsbCBiZWVuIGFwcGVuZGVkIGludG8gU291cmNlQnVmZmVyIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIHRwYXJzZWQsIHRidWZmZXJlZCwgbGVuZ3RofSB9XG4gIEZSQUdfQlVGRkVSRUQgOiAgJ2hsc0ZyYWdCdWZmZXJlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgbWF0Y2hpbmcgd2l0aCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uIGlzIGNoYW5naW5nIC0gZGF0YSA6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCB9XG4gIEZSQUdfQ0hBTkdFRCA6ICAnaGxzRnJhZ0NoYW5nZWQnLFxuICAgIC8vIElkZW50aWZpZXIgZm9yIGEgRlBTIGRyb3AgZXZlbnQgLSBkYXRhOiB7Y3VyZW50RHJvcHBlZCwgY3VycmVudERlY29kZWQsIHRvdGFsRHJvcHBlZEZyYW1lc31cbiAgRlBTX0RST1AgOiAgJ2hsc0ZQU0Ryb3AnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhbiBlcnJvciBldmVudCAtIGRhdGE6IHsgdHlwZSA6IGVycm9yIHR5cGUsIGRldGFpbHMgOiBlcnJvciBkZXRhaWxzLCBmYXRhbCA6IGlmIHRydWUsIGhscy5qcyBjYW5ub3Qvd2lsbCBub3QgdHJ5IHRvIHJlY292ZXIsIGlmIGZhbHNlLCBobHMuanMgd2lsbCB0cnkgdG8gcmVjb3ZlcixvdGhlciBlcnJvciBzcGVjaWZpYyBkYXRhfVxuICBFUlJPUiA6ICdobHNFcnJvcidcbn07XG4iLCIvKipcbiAqIEhMUyBpbnRlcmZhY2VcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgICAgICAgZnJvbSAnLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLEVycm9yRGV0YWlsc30gIGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCBTdGF0c0hhbmRsZXIgICAgICAgICAgICAgICBmcm9tICcuL3N0YXRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICAgICAgICBmcm9tICcuL29ic2VydmVyJztcbmltcG9ydCBQbGF5bGlzdExvYWRlciAgICAgICAgICAgICBmcm9tICcuL2xvYWRlci9wbGF5bGlzdC1sb2FkZXInO1xuaW1wb3J0IEZyYWdtZW50TG9hZGVyICAgICAgICAgICAgIGZyb20gJy4vbG9hZGVyL2ZyYWdtZW50LWxvYWRlcic7XG5pbXBvcnQgQnVmZmVyQ29udHJvbGxlciAgICAgICAgICAgZnJvbSAnLi9jb250cm9sbGVyL2J1ZmZlci1jb250cm9sbGVyJztcbmltcG9ydCBMZXZlbENvbnRyb2xsZXIgICAgICAgICAgICBmcm9tICcuL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlcic7XG4vL2ltcG9ydCBGUFNDb250cm9sbGVyICAgICAgICAgICAgICBmcm9tICcuL2NvbnRyb2xsZXIvZnBzLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsZW5hYmxlTG9nc30gICAgICAgIGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBYaHJMb2FkZXIgICAgICAgICAgICAgICAgICBmcm9tICcuL3V0aWxzL3hoci1sb2FkZXInO1xuXG5jbGFzcyBIbHMge1xuXG4gIHN0YXRpYyBpc1N1cHBvcnRlZCgpIHtcbiAgICByZXR1cm4gKHdpbmRvdy5NZWRpYVNvdXJjZSAmJiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50cygpIHtcbiAgICByZXR1cm4gRXZlbnQ7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yVHlwZXMoKSB7XG4gICAgcmV0dXJuIEVycm9yVHlwZXM7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yRGV0YWlscygpIHtcbiAgICByZXR1cm4gRXJyb3JEZXRhaWxzO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgIHZhciBjb25maWdEZWZhdWx0ID0ge1xuICAgICAgYXV0b1N0YXJ0TG9hZCA6IHRydWUsXG4gICAgICBkZWJ1ZyA6IGZhbHNlLFxuICAgICAgbWF4QnVmZmVyTGVuZ3RoIDogMzAsXG4gICAgICBtYXhCdWZmZXJTaXplIDogNjAqMTAwMCoxMDAwLFxuICAgICAgbWF4TWF4QnVmZmVyTGVuZ3RoIDogNjAwLFxuICAgICAgZW5hYmxlV29ya2VyIDogdHJ1ZSxcbiAgICAgIGZyYWdMb2FkaW5nVGltZU91dCA6IDIwMDAwLFxuICAgICAgZnJhZ0xvYWRpbmdNYXhSZXRyeSA6IDEsXG4gICAgICBmcmFnTG9hZGluZ1JldHJ5RGVsYXkgOiAxMDAwLFxuICAgICAgZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkIDogMyxcbiAgICAgIG1hbmlmZXN0TG9hZGluZ1RpbWVPdXQgOiAxMDAwMCxcbiAgICAgIG1hbmlmZXN0TG9hZGluZ01heFJldHJ5IDogMSxcbiAgICAgIG1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXkgOiAxMDAwLFxuICAgICAgZnBzRHJvcHBlZE1vbml0b3JpbmdQZXJpb2QgOiA1MDAwLFxuICAgICAgZnBzRHJvcHBlZE1vbml0b3JpbmdUaHJlc2hvbGQgOiAwLjIsXG4gICAgICBhcHBlbmRFcnJvck1heFJldHJ5IDogMjAwLFxuICAgICAgbG9hZGVyIDogWGhyTG9hZGVyXG4gICAgfTtcbiAgICBmb3IgKHZhciBwcm9wIGluIGNvbmZpZ0RlZmF1bHQpIHtcbiAgICAgICAgaWYgKHByb3AgaW4gY29uZmlnKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgIGNvbmZpZ1twcm9wXSA9IGNvbmZpZ0RlZmF1bHRbcHJvcF07XG4gICAgfVxuICAgIGVuYWJsZUxvZ3MoY29uZmlnLmRlYnVnKTtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIgPSBuZXcgRnJhZ21lbnRMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG5ldyBCdWZmZXJDb250cm9sbGVyKHRoaXMpO1xuICAgIC8vdGhpcy5mcHNDb250cm9sbGVyID0gbmV3IEZQU0NvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5zdGF0c0hhbmRsZXIgPSBuZXcgU3RhdHNIYW5kbGVyKHRoaXMpO1xuICAgIC8vIG9ic2VydmVyIHNldHVwXG4gICAgdGhpcy5vbiA9IG9ic2VydmVyLm9uLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMub2ZmID0gb2JzZXJ2ZXIub2ZmLmJpbmQob2JzZXJ2ZXIpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBsb2dnZXIubG9nKGBkZXN0cm95YCk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnVybCA9IG51bGw7XG4gICAgdGhpcy5kZXRhY2hWaWRlbygpO1xuICAgIG9ic2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICB9XG5cbiAgYXR0YWNoVmlkZW8odmlkZW8pIHtcbiAgICBsb2dnZXIubG9nKGBhdHRhY2hWaWRlb2ApO1xuICAgIHRoaXMudmlkZW8gPSB2aWRlbztcbiAgICB0aGlzLnN0YXRzSGFuZGxlci5hdHRhY2hWaWRlbyh2aWRlbyk7XG4gICAgLy8gc2V0dXAgdGhlIG1lZGlhIHNvdXJjZVxuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2UgPSBuZXcgTWVkaWFTb3VyY2UoKTtcbiAgICAvL01lZGlhIFNvdXJjZSBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbk1lZGlhU291cmNlT3Blbi5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTWVkaWFTb3VyY2VFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2MgPSB0aGlzLm9uTWVkaWFTb3VyY2VDbG9zZS5iaW5kKHRoaXMpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCAgdGhpcy5vbm1zbyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgIC8vIGxpbmsgdmlkZW8gYW5kIG1lZGlhIFNvdXJjZVxuICAgIHZpZGVvLnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwobXMpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJyx0aGlzLm9udmVycm9yKTtcbiAgfVxuXG4gIGRldGFjaFZpZGVvKCkge1xuICAgIGxvZ2dlci5sb2coYGRldGFjaFZpZGVvYCk7XG4gICAgdmFyIHZpZGVvID0gdGhpcy52aWRlbztcbiAgICB0aGlzLnN0YXRzSGFuZGxlci5kZXRhY2hWaWRlbyh2aWRlbyk7XG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICBpZihtcykge1xuICAgICAgaWYobXMucmVhZHlTdGF0ZSAhPT0gJ2VuZGVkJykge1xuICAgICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgfVxuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB2aWRlby5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgICAgbG9nZ2VyLmxvZyhgdHJpZ2dlciBNU0VfREVUQUNIRURgKTtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTVNFX0RFVEFDSEVEKTtcbiAgICB9XG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25tc2UgPSB0aGlzLm9ubXNjID0gbnVsbDtcbiAgICBpZih2aWRlbykge1xuICAgICAgdGhpcy52aWRlbyA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgbG9hZFNvdXJjZSh1cmwpIHtcbiAgICBsb2dnZXIubG9nKGBsb2FkU291cmNlOiR7dXJsfWApO1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIC8vIHdoZW4gYXR0YWNoaW5nIHRvIGEgc291cmNlIFVSTCwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWRcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsIHsgdXJsOiB1cmwgfSk7XG4gIH1cblxuICBzdGFydExvYWQoKSB7XG4gICAgbG9nZ2VyLmxvZyhgc3RhcnRMb2FkYCk7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyLnN0YXJ0TG9hZCgpO1xuICB9XG5cbiAgcmVjb3Zlck1lZGlhRXJyb3IoKSB7XG4gICAgbG9nZ2VyLmxvZygncmVjb3Zlck1lZGlhRXJyb3InKTtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHRoaXMuZGV0YWNoVmlkZW8oKTtcbiAgICB0aGlzLmF0dGFjaFZpZGVvKHZpZGVvKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gYWxsIHF1YWxpdHkgbGV2ZWxzICoqL1xuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbHM7XG4gIH1cblxuICAvKiogUmV0dXJuIGN1cnJlbnQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAqKi9cbiAgZ2V0IGN1cnJlbnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXJDb250cm9sbGVyLmN1cnJlbnRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGltbWVkaWF0ZWx5ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGN1cnJlbnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBjdXJyZW50TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgbmV4dCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBuZXh0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgbmV4dExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIubmV4dExldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIGN1cnJlbnQvbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIGN1cnJlbnQvbmV4dCBsb2FkZWQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbG9hZExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGxvYWRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbmV4dExvYWRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbCgpO1xuICB9XG5cbiAgLyoqIHNldCBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBzZXQgbmV4dExvYWRMZXZlbChsZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsID0gbGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgZmlyc3RMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsO1xuICB9XG5cbiAgLyoqIHNldCAgc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IHN0YXJ0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nO1xuICB9XG5cbiAgLyoqIHNldCB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBzZXQgYXV0b0xldmVsQ2FwcGluZyhuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBhdXRvTGV2ZWxDYXBwaW5nOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsICA9PT0gLTEpO1xuICB9XG5cbiAgLyogcmV0dXJuIG1hbnVhbCBsZXZlbCAqL1xuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsO1xuICB9XG5cblxuICAvKiByZXR1cm4gcGxheWJhY2sgc2Vzc2lvbiBzdGF0cyAqL1xuICBnZXQgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHNIYW5kbGVyLnN0YXRzO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIG9wZW5lZCcpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTVNFX0FUVEFDSEVELCB7IHZpZGVvOiB0aGlzLnZpZGVvLCBtZWRpYVNvdXJjZSA6IHRoaXMubWVkaWFTb3VyY2UgfSk7XG4gICAgLy8gb25jZSByZWNlaXZlZCwgZG9uJ3QgbGlzdGVuIGFueW1vcmUgdG8gc291cmNlb3BlbiBldmVudFxuICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiIC8qXG4gKiBmcmFnbWVudCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIEZyYWdtZW50TG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscz1obHM7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FESU5HLCB0aGlzLm9uZmwpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19MT0FESU5HLCB0aGlzLm9uZmwpO1xuICB9XG5cbiAgb25GcmFnTG9hZGluZyhldmVudCxkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSBkYXRhLmZyYWc7XG4gICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICB0aGlzLmZyYWcubG9hZGVkID0gMDtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSBuZXcgY29uZmlnLmxvYWRlcigpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQoZnJhZy51cmwsJ2FycmF5YnVmZmVyJyx0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnksY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSx0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciBwYXlsb2FkID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZTtcbiAgICBzdGF0cy5sZW5ndGggPSBwYXlsb2FkLmJ5dGVMZW5ndGg7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICB0aGlzLmZyYWcubG9hZGVyID0gdW5kZWZpbmVkO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgIHsgcGF5bG9hZCA6IHBheWxvYWQsXG4gICAgICAgICAgICAgICAgICAgICAgZnJhZyA6IHRoaXMuZnJhZyAsXG4gICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiBzdGF0c30pO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SLCBmYXRhbDpmYWxzZSxmcmFnIDogdGhpcy5mcmFnLCByZXNwb25zZTpldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQsIGZhdGFsOmZhbHNlLGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcyhldmVudCwgc3RhdHMpIHtcbiAgICB0aGlzLmZyYWcubG9hZGVkID0gc3RhdHMubG9hZGVkO1xuICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHsgZnJhZyA6IHRoaXMuZnJhZywgc3RhdHMgOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIHBsYXlsaXN0IGxvYWRlclxuICpcbiAqL1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuLy9pbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFBsYXlsaXN0TG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGluZy5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BRElORywgdGhpcy5vbmxsKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51cmwgPSB0aGlzLmlkID0gbnVsbDtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTEVWRUxfTE9BRElORywgdGhpcy5vbmxsKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsbnVsbCk7XG4gIH1cblxuICBvbkxldmVsTG9hZGluZyhldmVudCxkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLGRhdGEubGV2ZWwsZGF0YS5pZCk7XG4gIH1cblxuICBsb2FkKHVybCxpZDEsaWQyKSB7XG4gICAgdmFyIGNvbmZpZz10aGlzLmhscy5jb25maWc7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5pZCA9IGlkMTtcbiAgICB0aGlzLmlkMiA9IGlkMjtcbiAgICB0aGlzLmxvYWRlciA9IG5ldyBjb25maWcubG9hZGVyKCk7XG4gICAgdGhpcy5sb2FkZXIubG9hZCh1cmwsJycsdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5tYW5pZmVzdExvYWRpbmdUaW1lT3V0LCBjb25maWcubWFuaWZlc3RMb2FkaW5nTWF4UmV0cnksY29uZmlnLm1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXkpO1xuICB9XG5cbiAgcmVzb2x2ZSh1cmwsIGJhc2VVcmwpIHtcbiAgICB2YXIgZG9jICAgICAgPSBkb2N1bWVudCxcbiAgICAgICAgb2xkQmFzZSA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYmFzZScpWzBdLFxuICAgICAgICBvbGRIcmVmID0gb2xkQmFzZSAmJiBvbGRCYXNlLmhyZWYsXG4gICAgICAgIGRvY0hlYWQgPSBkb2MuaGVhZCB8fCBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXSxcbiAgICAgICAgb3VyQmFzZSA9IG9sZEJhc2UgfHwgZG9jSGVhZC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnYmFzZScpKSxcbiAgICAgICAgcmVzb2x2ZXIgPSBkb2MuY3JlYXRlRWxlbWVudCgnYScpLFxuICAgICAgICByZXNvbHZlZFVybDtcblxuICAgIG91ckJhc2UuaHJlZiA9IGJhc2VVcmw7XG4gICAgcmVzb2x2ZXIuaHJlZiA9IHVybDtcbiAgICByZXNvbHZlZFVybCAgPSByZXNvbHZlci5ocmVmOyAvLyBicm93c2VyIG1hZ2ljIGF0IHdvcmsgaGVyZVxuXG4gICAgaWYgKG9sZEJhc2UpIHtvbGRCYXNlLmhyZWYgPSBvbGRIcmVmO31cbiAgICBlbHNlIHtkb2NIZWFkLnJlbW92ZUNoaWxkKG91ckJhc2UpO31cbiAgICByZXR1cm4gcmVzb2x2ZWRVcmw7XG4gIH1cblxuICBwYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZyxiYXNldXJsKSB7XG4gICAgdmFyIGxldmVscyA9IFtdLGxldmVsID0gIHt9LHJlc3VsdCxjb2RlY3MsY29kZWM7XG4gICAgdmFyIHJlID0gLyNFWFQtWC1TVFJFQU0tSU5GOihbXlxcblxccl0qKEJBTkQpV0lEVEg9KFxcZCspKT8oW15cXG5cXHJdKihDT0RFQ1MpPVxcXCIoLiopXFxcIiwpPyhbXlxcblxccl0qKFJFUylPTFVUSU9OPShcXGQrKXgoXFxkKykpPyhbXlxcblxccl0qKE5BTUUpPVxcXCIoLiopXFxcIik/W15cXG5cXHJdKltcXHJcXG5dKyhbXlxcclxcbl0rKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4peyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7fSk7XG4gICAgICBsZXZlbC51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0LnBvcCgpLGJhc2V1cmwpO1xuICAgICAgd2hpbGUocmVzdWx0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgc3dpdGNoKHJlc3VsdC5zaGlmdCgpKSB7XG4gICAgICAgICAgY2FzZSAnUkVTJzpcbiAgICAgICAgICAgIGxldmVsLndpZHRoID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgbGV2ZWwuaGVpZ2h0ID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnQkFORCc6XG4gICAgICAgICAgICBsZXZlbC5iaXRyYXRlID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnTkFNRSc6XG4gICAgICAgICAgICBsZXZlbC5uYW1lID0gcmVzdWx0LnNoaWZ0KCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdDT0RFQ1MnOlxuICAgICAgICAgICAgY29kZWNzID0gcmVzdWx0LnNoaWZ0KCkuc3BsaXQoJywnKTtcbiAgICAgICAgICAgIHdoaWxlKGNvZGVjcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIGNvZGVjID0gY29kZWNzLnNoaWZ0KCk7XG4gICAgICAgICAgICAgIGlmKGNvZGVjLmluZGV4T2YoJ2F2YzEnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBsZXZlbC52aWRlb0NvZGVjID0gdGhpcy5hdmMxdG9hdmNvdGkoY29kZWMpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldmVsLmF1ZGlvQ29kZWMgPSBjb2RlYztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgICBsZXZlbCA9IHt9O1xuICAgIH1cbiAgICByZXR1cm4gbGV2ZWxzO1xuICB9XG5cbiAgYXZjMXRvYXZjb3RpKGNvZGVjKSB7XG4gICAgdmFyIHJlc3VsdCxhdmNkYXRhID0gY29kZWMuc3BsaXQoJy4nKTtcbiAgICBpZihhdmNkYXRhLmxlbmd0aCA+IDIpIHtcbiAgICAgIHJlc3VsdCA9IGF2Y2RhdGEuc2hpZnQoKSArICcuJztcbiAgICAgIHJlc3VsdCArPSBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJlc3VsdCArPSAoJzAwJyArIHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBjb2RlYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwsIGlkKSB7XG4gICAgdmFyIGN1cnJlbnRTTiA9IDAsdG90YWxkdXJhdGlvbiA9IDAsIGxldmVsID0geyB1cmwgOiBiYXNldXJsLCBmcmFnbWVudHMgOiBbXSwgbGl2ZSA6IHRydWUsIHN0YXJ0U04gOiAwfSwgcmVzdWx0LCByZWdleHAsIGNjID0gMDtcbiAgICByZWdleHAgPSAvKD86I0VYVC1YLShNRURJQS1TRVFVRU5DRSk6KFxcZCspKXwoPzojRVhULVgtKFRBUkdFVERVUkFUSU9OKTooXFxkKykpfCg/OiNFWFQoSU5GKTooW1xcZFxcLl0rKVteXFxyXFxuXSpbXFxyXFxuXSsoW15cXHJcXG5dKyl8KD86I0VYVC1YLShFTkRMSVNUKSl8KD86I0VYVC1YLShESVMpQ09OVElOVUlUWSkpL2c7XG4gICAgd2hpbGUoKHJlc3VsdCA9IHJlZ2V4cC5leGVjKHN0cmluZykpICE9PSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKXsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpO30pO1xuICAgICAgc3dpdGNoKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gbGV2ZWwuc3RhcnRTTiA9IHBhcnNlSW50KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1RBUkdFVERVUkFUSU9OJzpcbiAgICAgICAgICBsZXZlbC50YXJnZXRkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRU5ETElTVCc6XG4gICAgICAgICAgbGV2ZWwubGl2ZSA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdESVMnOlxuICAgICAgICAgIGNjKys7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0lORic6XG4gICAgICAgICAgdmFyIGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGxldmVsLmZyYWdtZW50cy5wdXNoKHt1cmwgOiB0aGlzLnJlc29sdmUocmVzdWx0WzJdLGJhc2V1cmwpLCBkdXJhdGlvbiA6IGR1cmF0aW9uLCBzdGFydCA6IHRvdGFsZHVyYXRpb24sIHNuIDogY3VycmVudFNOKyssIGxldmVsOmlkLCBjYyA6IGNjfSk7XG4gICAgICAgICAgdG90YWxkdXJhdGlvbis9ZHVyYXRpb247XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZm91bmQgJyArIGxldmVsLmZyYWdtZW50cy5sZW5ndGggKyAnIGZyYWdtZW50cycpO1xuICAgIGxldmVsLnRvdGFsZHVyYXRpb24gPSB0b3RhbGR1cmF0aW9uO1xuICAgIGxldmVsLmVuZFNOID0gY3VycmVudFNOIC0gMTtcbiAgICByZXR1cm4gbGV2ZWw7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgc3RyaW5nID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVRleHQsIHVybCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VVUkwsIGlkID0gdGhpcy5pZCxpZDI9IHRoaXMuaWQyLCBsZXZlbHM7XG4gICAgLy8gcmVzcG9uc2VVUkwgbm90IHN1cHBvcnRlZCBvbiBzb21lIGJyb3dzZXJzIChpdCBpcyB1c2VkIHRvIGRldGVjdCBVUkwgcmVkaXJlY3Rpb24pXG4gICAgaWYodXJsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGZhbGxiYWNrIHRvIGluaXRpYWwgVVJMXG4gICAgICB1cmwgPSB0aGlzLnVybDtcbiAgICB9XG4gICAgc3RhdHMudGxvYWQgPSBuZXcgRGF0ZSgpO1xuICAgIHN0YXRzLm10aW1lID0gbmV3IERhdGUoZXZlbnQuY3VycmVudFRhcmdldC5nZXRSZXNwb25zZUhlYWRlcignTGFzdC1Nb2RpZmllZCcpKTtcblxuICAgIGlmKHN0cmluZy5pbmRleE9mKCcjRVhUTTNVJykgPT09IDApIHtcbiAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVElORjonKSA+IDApIHtcbiAgICAgICAgLy8gMSBsZXZlbCBwbGF5bGlzdFxuICAgICAgICAvLyBpZiBmaXJzdCByZXF1ZXN0LCBmaXJlIG1hbmlmZXN0IGxvYWRlZCBldmVudCwgbGV2ZWwgd2lsbCBiZSByZWxvYWRlZCBhZnRlcndhcmRzXG4gICAgICAgIC8vICh0aGlzIGlzIHRvIGhhdmUgYSB1bmlmb3JtIGxvZ2ljIGZvciAxIGxldmVsL211bHRpbGV2ZWwgcGxheWxpc3RzKVxuICAgICAgICBpZih0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogW3t1cmwgOiB1cmx9XSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiB1cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiBzdGF0c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgICB7IGRldGFpbHMgOiB0aGlzLnBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsdXJsLGlkKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbCA6IGlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkIDogaWQyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogc3RhdHN9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzID0gdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZyx1cmwpO1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICBpZihsZXZlbHMubGVuZ3RoKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogbGV2ZWxzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwgeyB0eXBlIDogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOnRydWUsIHVybCA6IHVybCwgcmVhc29uIDogJ25vIGxldmVsIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHsgdHlwZSA6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDp0cnVlLCB1cmwgOiB1cmwsIHJlYXNvbiA6ICdubyBFWFRNM1UgZGVsaW1pdGVyJ30pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHZhciBkZXRhaWxzLGZhdGFsO1xuICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9FUlJPUjtcbiAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczpkZXRhaWxzLCBmYXRhbDpmYXRhbCwgdXJsOnRoaXMudXJsLCBsb2FkZXIgOiB0aGlzLmxvYWRlciwgcmVzcG9uc2U6ZXZlbnQuY3VycmVudFRhcmdldCwgbGV2ZWw6IHRoaXMuaWQsIGlkIDogdGhpcy5pZDJ9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHZhciBkZXRhaWxzLGZhdGFsO1xuICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDtcbiAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgfVxuICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHsgdHlwZSA6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczpkZXRhaWxzLCBmYXRhbDpmYXRhbCwgdXJsIDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIGxldmVsOiB0aGlzLmlkLCBpZCA6IHRoaXMuaWQyfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCJpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5cbmxldCBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcblxub2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbn07XG5cbm9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIC4uLmRhdGEpO1xufTtcblxuXG5leHBvcnQgZGVmYXVsdCBvYnNlcnZlcjtcbiIsIi8qKlxuICogZ2VuZXJhdGUgTVA0IEJveFxuICovXG5cbmNsYXNzIE1QNCB7XG4gIHN0YXRpYyBpbml0KCkge1xuICAgIE1QNC50eXBlcyA9IHtcbiAgICAgIGF2YzE6IFtdLCAvLyBjb2RpbmduYW1lXG4gICAgICBhdmNDOiBbXSxcbiAgICAgIGJ0cnQ6IFtdLFxuICAgICAgZGluZjogW10sXG4gICAgICBkcmVmOiBbXSxcbiAgICAgIGVzZHM6IFtdLFxuICAgICAgZnR5cDogW10sXG4gICAgICBoZGxyOiBbXSxcbiAgICAgIG1kYXQ6IFtdLFxuICAgICAgbWRoZDogW10sXG4gICAgICBtZGlhOiBbXSxcbiAgICAgIG1maGQ6IFtdLFxuICAgICAgbWluZjogW10sXG4gICAgICBtb29mOiBbXSxcbiAgICAgIG1vb3Y6IFtdLFxuICAgICAgbXA0YTogW10sXG4gICAgICBtdmV4OiBbXSxcbiAgICAgIG12aGQ6IFtdLFxuICAgICAgc2R0cDogW10sXG4gICAgICBzdGJsOiBbXSxcbiAgICAgIHN0Y286IFtdLFxuICAgICAgc3RzYzogW10sXG4gICAgICBzdHNkOiBbXSxcbiAgICAgIHN0c3o6IFtdLFxuICAgICAgc3R0czogW10sXG4gICAgICB0ZmR0OiBbXSxcbiAgICAgIHRmaGQ6IFtdLFxuICAgICAgdHJhZjogW10sXG4gICAgICB0cmFrOiBbXSxcbiAgICAgIHRydW46IFtdLFxuICAgICAgdHJleDogW10sXG4gICAgICB0a2hkOiBbXSxcbiAgICAgIHZtaGQ6IFtdLFxuICAgICAgc21oZDogW11cbiAgICB9O1xuXG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIE1QNC50eXBlcykge1xuICAgICAgaWYgKE1QNC50eXBlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBNUDQudHlwZXNbaV0gPSBbXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDApLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgxKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMiksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDMpXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgTVA0Lk1BSk9SX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2knLmNoYXJDb2RlQXQoMCksXG4gICAgICAncycuY2hhckNvZGVBdCgwKSxcbiAgICAgICdvJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ20nLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuQVZDMV9CUkFORCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICdhJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ3YnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnYycuY2hhckNvZGVBdCgwKSxcbiAgICAgICcxJy5jaGFyQ29kZUF0KDApXG4gICAgXSk7XG4gICAgTVA0Lk1JTk9SX1ZFUlNJT04gPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMV0pO1xuICAgIE1QNC5WSURFT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuQVVESU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOk1QNC5WSURFT19IRExSLFxuICAgICAgJ2F1ZGlvJzpNUDQuQVVESU9fSERMUlxuICAgIH07XG4gICAgTVA0LkRSRUYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG4gICAgTVA0LlNUQ08gPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCAvLyBlbnRyeV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5TVFNDID0gTVA0LlNUQ087XG4gICAgTVA0LlNUVFMgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIE1QNC5NQUpPUl9CUkFORCwgTVA0Lk1JTk9SX1ZFUlNJT04sIE1QNC5NQUpPUl9CUkFORCwgTVA0LkFWQzFfQlJBTkQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgTVA0LkRSRUYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gMCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgcmVzdWx0LFxuICAgIHZpZXc7XG5cbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShzaXplICsgOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhyZXN1bHQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLCByZXN1bHQuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcblxuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBwYXlsb2FkLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZCh0aW1lc2NhbGUsZHVyYXRpb24pIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMywgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICh0aW1lc2NhbGUgPj4gMjQpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgIHRpbWVzY2FsZSAmIDB4RkYsIC8vIHRpbWVzY2FsZVxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDU1LCAweGM0LCAvLyAndW5kJyBsYW5ndWFnZSAodW5kZXRlcm1pbmVkKVxuICAgICAgMHgwMCwgMHgwMFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGlhKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaWEsIE1QNC5tZGhkKHRyYWNrLnRpbWVzY2FsZSx0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMjQpLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gIDgpICYgMHhGRixcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnNtaGQsIE1QNC5TTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy52bWhkLCBNUDQuVk1IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBtb29mKHNuLCBiYXNlTWVkaWFEZWNvZGVUaW1lLCB0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tb29mLFxuICAgICAgICAgICAgICAgICAgIE1QNC5tZmhkKHNuKSxcbiAgICAgICAgICAgICAgICAgICBNUDQudHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSk7XG4gIH1cbi8qKlxuICogQHBhcmFtIHRyYWNrcy4uLiAob3B0aW9uYWwpIHthcnJheX0gdGhlIHRyYWNrcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBtb3ZpZVxuICovXG4gIHN0YXRpYyBtb292KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJhayh0cmFja3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubW9vdiwgTVA0Lm12aGQodHJhY2tzWzBdLnRpbWVzY2FsZSx0cmFja3NbMF0uZHVyYXRpb24pXS5jb25jYXQoYm94ZXMpLmNvbmNhdChNUDQubXZleCh0cmFja3MpKSk7XG4gIH1cblxuICBzdGF0aWMgbXZleCh0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyZXgodHJhY2tzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tdmV4XS5jb25jYXQoYm94ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmhkKHRpbWVzY2FsZSxkdXJhdGlvbikge1xuICAgIHZhclxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAgICh0aW1lc2NhbGUgPj4gMjQpICYgMHhGRixcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAxNikgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIHRpbWVzY2FsZSAmIDB4RkYsIC8vIHRpbWVzY2FsZVxuICAgICAgICAoZHVyYXRpb24gPj4gMjQpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsIC8vIDEuMCByYXRlXG4gICAgICAgIDB4MDEsIDB4MDAsIC8vIDEuMCB2b2x1bWVcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweGZmLCAweGZmLCAweGZmLCAweGZmIC8vIG5leHRfdHJhY2tfSURcbiAgICAgIF0pO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tdmhkLCBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc2R0cCh0cmFjaykge1xuICAgIHZhclxuICAgICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KDQgKyBzYW1wbGVzLmxlbmd0aCksXG4gICAgICBmbGFncyxcbiAgICAgIGk7XG5cbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGFncyA9IHNhbXBsZXNbaV0uZmxhZ3M7XG4gICAgICBieXRlc1tpICsgNF0gPSAoZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc2R0cCxcbiAgICAgICAgICAgICAgIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsXG4gICAgICAgICAgICAgICBNUDQuc3RzZCh0cmFjayksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHRzLCBNUDQuU1RUUyksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHN6LCBNUDQuU1RTWiksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdGNvLCBNUDQuU1RDTykpO1xuICB9XG5cbiAgc3RhdGljIGF2YzEodHJhY2spIHtcbiAgICB2YXIgc3BzID0gW10sIHBwcyA9IFtdLCBpO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnNwcy5sZW5ndGg7IGkrKykge1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoID4+PiA4KSAmIDB4RkYpO1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpOyAvLyBzZXF1ZW5jZVBhcmFtZXRlclNldExlbmd0aFxuICAgICAgc3BzID0gc3BzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5zcHNbaV0pKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggPj4+IDgpICYgMHhGRik7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRyYWNrLnBwc1tpXSkpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5hdmMxLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgICh0cmFjay53aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLndpZHRoICYgMHhmZiwgLy8gd2lkdGhcbiAgICAgICAgKHRyYWNrLmhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmhlaWdodCAmIDB4ZmYsIC8vIGhlaWdodFxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gdmVydHJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgICAgMHgxMyxcbiAgICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgICAgMHg2ZiwgMHg2YSwgMHg3MywgMHgyZCxcbiAgICAgICAgMHg2MywgMHg2ZiwgMHg2ZSwgMHg3NCxcbiAgICAgICAgMHg3MiwgMHg2OSwgMHg2MiwgMHgyZCxcbiAgICAgICAgMHg2OCwgMHg2YywgMHg3MywgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgICAgMHgwMCwgMHgxOCwgLy8gZGVwdGggPSAyNFxuICAgICAgICAweDExLCAweDExXSksIC8vIHByZV9kZWZpbmVkID0gLTFcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5hdmNDLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAxLCAvLyBjb25maWd1cmF0aW9uVmVyc2lvblxuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUlkYywgLy8gQVZDUHJvZmlsZUluZGljYXRpb25cbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXQsIC8vIHByb2ZpbGVfY29tcGF0aWJpbGl0eVxuICAgICAgICAgICAgdHJhY2subGV2ZWxJZGMsIC8vIEFWQ0xldmVsSW5kaWNhdGlvblxuICAgICAgICAgICAgMHhmZiAvLyBsZW5ndGhTaXplTWludXNPbmUsIGhhcmQtY29kZWQgdG8gNCBieXRlc1xuICAgICAgICAgIF0uY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnNwcy5sZW5ndGggLy8gbnVtT2ZTZXF1ZW5jZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQoc3BzKS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2sucHBzLmxlbmd0aCAvLyBudW1PZlBpY3R1cmVQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHBwcykpKSwgLy8gXCJQUFNcIlxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmJ0cnQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDAsIDB4MWMsIDB4OWMsIDB4ODAsIC8vIGJ1ZmZlclNpemVEQlxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMF0pKSAvLyBhdmdCaXRyYXRlXG4gICAgICAgICAgKTtcbiAgfVxuXG4gIHN0YXRpYyBlc2RzKHRyYWNrKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcblxuICAgICAgMHgwMywgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDE3K3RyYWNrLmNvbmZpZy5sZW5ndGgsIC8vIGxlbmd0aFxuICAgICAgMHgwMCwgMHgwMSwgLy9lc19pZFxuICAgICAgMHgwMCwgLy8gc3RyZWFtX3ByaW9yaXR5XG5cbiAgICAgIDB4MDQsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgwZit0cmFjay5jb25maWcubGVuZ3RoLCAvLyBsZW5ndGhcbiAgICAgIDB4NDAsIC8vY29kZWMgOiBtcGVnNF9hdWRpb1xuICAgICAgMHgxNSwgLy8gc3RyZWFtX3R5cGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGJ1ZmZlcl9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBhdmdCaXRyYXRlXG5cbiAgICAgIDB4MDUgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICBdLmNvbmNhdChbdHJhY2suY29uZmlnLmxlbmd0aF0pLmNvbmNhdCh0cmFjay5jb25maWcpLmNvbmNhdChbMHgwNiwgMHgwMSwgMHgwMl0pKTsgLy8gR0FTcGVjaWZpY0NvbmZpZykpOyAvLyBsZW5ndGggKyBhdWRpbyBjb25maWcgZGVzY3JpcHRvclxuICB9XG5cbiAgc3RhdGljIG1wNGEodHJhY2spIHtcbiAgICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1wNGEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgdHJhY2suY2hhbm5lbENvdW50LCAvLyBjaGFubmVsY291bnRcbiAgICAgICAgMHgwMCwgMHgxMCwgLy8gc2FtcGxlU2l6ZToxNmJpdHNcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWQyXG4gICAgICAgICh0cmFjay5hdWRpb3NhbXBsZXJhdGUgPj4gOCkgJiAweEZGLFxuICAgICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgJiAweGZmLCAvL1xuICAgICAgICAweDAwLCAweDAwXSksXG4gICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmVzZHMsIE1QNC5lc2RzKHRyYWNrKSkpO1xuICB9XG5cbiAgc3RhdGljIHN0c2QodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNEICwgTVA0Lm1wNGEodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNEICwgTVA0LmF2YzEodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdGtoZCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50a2hkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDcsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRyYWNrLmlkID4+IDI0KSAmIDB4RkYsXG4gICAgICAodHJhY2suaWQgPj4gMTYpICYgMHhGRixcbiAgICAgICh0cmFjay5pZCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5pZCAmIDB4RkYsIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+IDI0KSxcbiAgICAgICh0cmFjay5kdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5kdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgICAweDAwLCAweDAwLCAvLyBhbHRlcm5hdGVfZ3JvdXBcbiAgICAgIDB4MDAsIDB4MDAsIC8vIG5vbi1hdWRpbyB0cmFjayB2b2x1bWVcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICh0cmFjay53aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay53aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKHRyYWNrLmhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5oZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAyNCksXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4yNCksXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLFxuICAgICAgICAgICAgICAgTVA0LnRraGQodHJhY2spLFxuICAgICAgICAgICAgICAgTVA0Lm1kaWEodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmV4KHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyZXgsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgKHRyYWNrLmlkID4+IDI0KSxcbiAgICAgKHRyYWNrLmlkID4+IDE2KSAmIDBYRkYsXG4gICAgICh0cmFjay5pZCA+PiA4KSAmIDBYRkYsXG4gICAgICh0cmFjay5pZCAmIDB4RkYpLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZGVmYXVsdF9zYW1wbGVfZGVzY3JpcHRpb25faW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX2R1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAxIC8vIGRlZmF1bHRfc2FtcGxlX2ZsYWdzXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRydW4odHJhY2ssIG9mZnNldCkge1xuICAgIHZhciBzYW1wbGVzLCBzYW1wbGUsIGksIGFycmF5O1xuXG4gICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW107XG4gICAgYXJyYXkgPSBuZXcgVWludDhBcnJheSgxMiArICgxNiAqIHNhbXBsZXMubGVuZ3RoKSk7XG4gICAgb2Zmc2V0ICs9IDggKyBhcnJheS5ieXRlTGVuZ3RoO1xuXG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gOCkgJiAweEZGLFxuICAgICAgc2FtcGxlcy5sZW5ndGggJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF0sMCk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGFycmF5LnNldChbXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLmR1cmF0aW9uICYgMHhGRiwgLy8gc2FtcGxlX2R1cmF0aW9uXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLnNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgICAoc2FtcGxlLmZsYWdzLmlzTGVhZGluZyA8PCAyKSB8IHNhbXBsZS5mbGFncy5kZXBlbmRzT24sXG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDYpIHxcbiAgICAgICAgICAoc2FtcGxlLmZsYWdzLmhhc1JlZHVuZGFuY3kgPDwgNCkgfFxuICAgICAgICAgIChzYW1wbGUuZmxhZ3MucGFkZGluZ1ZhbHVlIDw8IDEpIHxcbiAgICAgICAgICBzYW1wbGUuZmxhZ3MuaXNOb25TeW5jLFxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkUHJpbyAmIDB4RjAgPDwgOCxcbiAgICAgICAgc2FtcGxlLmZsYWdzLmRlZ3JhZFByaW8gJiAweDBGLCAvLyBzYW1wbGVfZmxhZ3NcbiAgICAgICAgKHNhbXBsZS5jdHMgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuY3RzID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmN0cyA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuY3RzICYgMHhGRiAvLyBzYW1wbGVfY29tcG9zaXRpb25fdGltZV9vZmZzZXRcbiAgICAgIF0sMTIrMTYqaSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cnVuLCBhcnJheSk7XG4gIH1cblxuICBzdGF0aWMgaW5pdFNlZ21lbnQodHJhY2tzKSB7XG5cbiAgICBpZighTVA0LnR5cGVzKSB7XG4gICAgICBNUDQuaW5pdCgpO1xuICAgIH1cbiAgICB2YXJcbiAgICAgIG1vdmllID0gTVA0Lm1vb3YodHJhY2tzKSxcbiAgICAgIHJlc3VsdDtcblxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KE1QNC5GVFlQLmJ5dGVMZW5ndGggKyBtb3ZpZS5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KE1QNC5GVFlQKTtcbiAgICByZXN1bHQuc2V0KG1vdmllLCBNUDQuRlRZUC5ieXRlTGVuZ3RoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1QNDtcblxuXG4iLCIgLypcbiAqIFN0YXRzIEhhbmRsZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuL29ic2VydmVyJztcblxuIGNsYXNzIFN0YXRzSGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHM9aGxzO1xuICAgIHRoaXMub25tcCA9IHRoaXMub25NYW5pZmVzdFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mYyA9IHRoaXMub25GcmFnbWVudENoYW5nZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmIgPSB0aGlzLm9uRnJhZ21lbnRCdWZmZXJlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbGVhID0gdGhpcy5vbkZyYWdtZW50TG9hZEVtZXJnZW5jeUFib3J0ZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZXJyID0gdGhpcy5vbkVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwc2QgPSB0aGlzLm9uRlBTRHJvcC5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0JVRkZFUkVELCB0aGlzLm9uZmIpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfQ0hBTkdFRCwgdGhpcy5vbmZjKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB0aGlzLm9uZmxlYSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlBTX0RST1AsIHRoaXMub25mcHNkKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19CVUZGRVJFRCwgdGhpcy5vbmZiKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19DSEFOR0VELCB0aGlzLm9uZmMpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCwgdGhpcy5vbmZsZWEpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUFNfRFJPUCwgdGhpcy5vbmZwc2QpO1xuICB9XG5cbiAgYXR0YWNoVmlkZW8odmlkZW8pIHtcbiAgICB0aGlzLnZpZGVvID0gdmlkZW87XG4gIH1cblxuICBkZXRhY2hWaWRlbygpIHtcbiAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgfVxuXG4gIC8vIHJlc2V0IHN0YXRzIG9uIG1hbmlmZXN0IHBhcnNlZFxuICBvbk1hbmlmZXN0UGFyc2VkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLl9zdGF0cyA9IHsgdGVjaCA6ICdobHMuanMnLCBsZXZlbE5iIDogZGF0YS5sZXZlbHMubGVuZ3RofTtcbiAgfVxuXG4gIC8vIG9uIGZyYWdtZW50IGNoYW5nZWQgaXMgdHJpZ2dlcmVkIHdoZW5ldmVyIHBsYXliYWNrIG9mIGEgbmV3IGZyYWdtZW50IGlzIHN0YXJ0aW5nIC4uLlxuICBvbkZyYWdtZW50Q2hhbmdlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5fc3RhdHMsbGV2ZWwgPSBkYXRhLmZyYWcubGV2ZWwsYXV0b0xldmVsID0gZGF0YS5mcmFnLmF1dG9MZXZlbDtcbiAgICBpZihzdGF0cykge1xuICAgICAgaWYoc3RhdHMubGV2ZWxTdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHN0YXRzLmxldmVsU3RhcnQgPSBsZXZlbDtcbiAgICAgIH1cbiAgICAgIGlmKGF1dG9MZXZlbCkge1xuICAgICAgICBpZihzdGF0cy5mcmFnQ2hhbmdlZEF1dG8pIHtcbiAgICAgICAgICBzdGF0cy5hdXRvTGV2ZWxNaW4gPSBNYXRoLm1pbihzdGF0cy5hdXRvTGV2ZWxNaW4sbGV2ZWwpO1xuICAgICAgICAgIHN0YXRzLmF1dG9MZXZlbE1heCA9IE1hdGgubWF4KHN0YXRzLmF1dG9MZXZlbE1heCxsZXZlbCk7XG4gICAgICAgICAgc3RhdHMuZnJhZ0NoYW5nZWRBdXRvKys7XG4gICAgICAgICAgaWYodGhpcy5sZXZlbExhc3RBdXRvICYmIGxldmVsICE9PSBzdGF0cy5hdXRvTGV2ZWxMYXN0KSB7XG4gICAgICAgICAgICBzdGF0cy5hdXRvTGV2ZWxTd2l0Y2grKztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RhdHMuYXV0b0xldmVsTWluID0gc3RhdHMuYXV0b0xldmVsTWF4ID0gbGV2ZWw7XG4gICAgICAgICAgc3RhdHMuYXV0b0xldmVsU3dpdGNoID0gMDtcbiAgICAgICAgICBzdGF0cy5mcmFnQ2hhbmdlZEF1dG8gPSAxO1xuICAgICAgICAgIHRoaXMuc3VtQXV0b0xldmVsID0gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN1bUF1dG9MZXZlbCs9bGV2ZWw7XG4gICAgICAgIHN0YXRzLmF1dG9MZXZlbEF2ZyA9IE1hdGgucm91bmQoMTAwMCp0aGlzLnN1bUF1dG9MZXZlbC9zdGF0cy5mcmFnQ2hhbmdlZEF1dG8pLzEwMDA7XG4gICAgICAgIHN0YXRzLmF1dG9MZXZlbExhc3QgPSBsZXZlbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmKHN0YXRzLmZyYWdDaGFuZ2VkTWFudWFsKSB7XG4gICAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxNaW4gPSBNYXRoLm1pbihzdGF0cy5tYW51YWxMZXZlbE1pbixsZXZlbCk7XG4gICAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxNYXggPSBNYXRoLm1heChzdGF0cy5tYW51YWxMZXZlbE1heCxsZXZlbCk7XG4gICAgICAgICAgc3RhdHMuZnJhZ0NoYW5nZWRNYW51YWwrKztcbiAgICAgICAgICBpZighdGhpcy5sZXZlbExhc3RBdXRvICYmIGxldmVsICE9PSBzdGF0cy5tYW51YWxMZXZlbExhc3QpIHtcbiAgICAgICAgICAgIHN0YXRzLm1hbnVhbExldmVsU3dpdGNoKys7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0YXRzLm1hbnVhbExldmVsTWluID0gc3RhdHMubWFudWFsTGV2ZWxNYXggPSBsZXZlbDtcbiAgICAgICAgICBzdGF0cy5tYW51YWxMZXZlbFN3aXRjaCA9IDA7XG4gICAgICAgICAgc3RhdHMuZnJhZ0NoYW5nZWRNYW51YWwgPSAxO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRzLm1hbnVhbExldmVsTGFzdCA9IGxldmVsO1xuICAgICAgfVxuICAgICAgdGhpcy5sZXZlbExhc3RBdXRvID0gYXV0b0xldmVsO1xuICAgIH1cbiAgfVxuXG4gIC8vIHRyaWdnZXJlZCBlYWNoIHRpbWUgYSBuZXcgZnJhZ21lbnQgaXMgYnVmZmVyZWRcbiAgb25GcmFnbWVudEJ1ZmZlcmVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLl9zdGF0cyxsYXRlbmN5ID0gZGF0YS5zdGF0cy50Zmlyc3QgLSBkYXRhLnN0YXRzLnRyZXF1ZXN0LCBwcm9jZXNzID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgLSBkYXRhLnN0YXRzLnRyZXF1ZXN0LCBiaXRyYXRlID0gTWF0aC5yb3VuZCg4KmRhdGEuc3RhdHMubGVuZ3RoLyhkYXRhLnN0YXRzLnRidWZmZXJlZCAtIGRhdGEuc3RhdHMudGZpcnN0KSk7XG4gICAgaWYoc3RhdHMuZnJhZ0J1ZmZlcmVkKSB7XG4gICAgICBzdGF0cy5mcmFnTWluTGF0ZW5jeSA9IE1hdGgubWluKHN0YXRzLmZyYWdNaW5MYXRlbmN5LGxhdGVuY3kpO1xuICAgICAgc3RhdHMuZnJhZ01heExhdGVuY3kgPSBNYXRoLm1heChzdGF0cy5mcmFnTWF4TGF0ZW5jeSxsYXRlbmN5KTtcbiAgICAgIHN0YXRzLmZyYWdNaW5Qcm9jZXNzID0gTWF0aC5taW4oc3RhdHMuZnJhZ01pblByb2Nlc3MscHJvY2Vzcyk7XG4gICAgICBzdGF0cy5mcmFnTWF4UHJvY2VzcyA9IE1hdGgubWF4KHN0YXRzLmZyYWdNYXhQcm9jZXNzLHByb2Nlc3MpO1xuICAgICAgc3RhdHMuZnJhZ01pbkticHMgPSBNYXRoLm1pbihzdGF0cy5mcmFnTWluS2JwcyxiaXRyYXRlKTtcbiAgICAgIHN0YXRzLmZyYWdNYXhLYnBzID0gTWF0aC5tYXgoc3RhdHMuZnJhZ01heEticHMsYml0cmF0ZSk7XG4gICAgICBzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWluID0gTWF0aC5taW4oc3RhdHMuYXV0b0xldmVsQ2FwcGluZ01pbix0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nKTtcbiAgICAgIHN0YXRzLmF1dG9MZXZlbENhcHBpbmdNYXggPSBNYXRoLm1heChzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWF4LHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmcpO1xuICAgICAgc3RhdHMuZnJhZ0J1ZmZlcmVkKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRzLmZyYWdNaW5MYXRlbmN5ID0gc3RhdHMuZnJhZ01heExhdGVuY3kgPSBsYXRlbmN5O1xuICAgICAgc3RhdHMuZnJhZ01pblByb2Nlc3MgPSBzdGF0cy5mcmFnTWF4UHJvY2VzcyA9IHByb2Nlc3M7XG4gICAgICBzdGF0cy5mcmFnTWluS2JwcyA9IHN0YXRzLmZyYWdNYXhLYnBzID0gYml0cmF0ZTtcbiAgICAgIHN0YXRzLmZyYWdCdWZmZXJlZCA9IDE7XG4gICAgICBzdGF0cy5mcmFnQnVmZmVyZWRCeXRlcyA9IDA7XG4gICAgICBzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWluID0gc3RhdHMuYXV0b0xldmVsQ2FwcGluZ01heCA9IHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmc7XG4gICAgICB0aGlzLnN1bUxhdGVuY3k9MDtcbiAgICAgIHRoaXMuc3VtS2Jwcz0wO1xuICAgICAgdGhpcy5zdW1Qcm9jZXNzPTA7XG4gICAgfVxuICAgIHN0YXRzLmZyYWdsYXN0TGF0ZW5jeT1sYXRlbmN5O1xuICAgIHRoaXMuc3VtTGF0ZW5jeSs9bGF0ZW5jeTtcbiAgICBzdGF0cy5mcmFnQXZnTGF0ZW5jeSA9IE1hdGgucm91bmQodGhpcy5zdW1MYXRlbmN5L3N0YXRzLmZyYWdCdWZmZXJlZCk7XG4gICAgc3RhdHMuZnJhZ0xhc3RQcm9jZXNzPXByb2Nlc3M7XG4gICAgdGhpcy5zdW1Qcm9jZXNzKz1wcm9jZXNzO1xuICAgIHN0YXRzLmZyYWdBdmdQcm9jZXNzID0gTWF0aC5yb3VuZCh0aGlzLnN1bVByb2Nlc3Mvc3RhdHMuZnJhZ0J1ZmZlcmVkKTtcbiAgICBzdGF0cy5mcmFnTGFzdEticHM9Yml0cmF0ZTtcbiAgICB0aGlzLnN1bUticHMrPWJpdHJhdGU7XG4gICAgc3RhdHMuZnJhZ0F2Z0ticHMgPSBNYXRoLnJvdW5kKHRoaXMuc3VtS2Jwcy9zdGF0cy5mcmFnQnVmZmVyZWQpO1xuICAgIHN0YXRzLmZyYWdCdWZmZXJlZEJ5dGVzKz1kYXRhLnN0YXRzLmxlbmd0aDtcbiAgICBzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTGFzdCA9IHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZEVtZXJnZW5jeUFib3J0ZWQoKSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5fc3RhdHM7XG4gICAgaWYoc3RhdHMpIHtcbiAgICAgIGlmKHN0YXRzLmZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHN0YXRzLmZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCA9MTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXRzLmZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRXJyb3IoZXZlbnQsZGF0YSkge1xuICAgIHZhciBzdGF0cyA9IHRoaXMuX3N0YXRzO1xuICAgIGlmKHN0YXRzKSB7XG4gICAgICAvLyB0cmFjayBhbGwgZXJyb3JzIGluZGVwZW5kZW50bHlcbiAgICAgIGlmKHN0YXRzW2RhdGEuZGV0YWlsc10gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzdGF0c1tkYXRhLmRldGFpbHNdID0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdHNbZGF0YS5kZXRhaWxzXSs9MTtcbiAgICAgIH1cbiAgICAgIC8vIHRyYWNrIGZhdGFsIGVycm9yXG4gICAgICBpZihkYXRhLmZhdGFsKSB7XG4gICAgICAgIGlmKHN0YXRzLmZhdGFsRXJyb3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3RhdHMuZmF0YWxFcnJvcj0xO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdHMuZmF0YWxFcnJvcis9MTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRlBTRHJvcChldmVudCxkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5fc3RhdHM7XG4gICAgaWYoc3RhdHMpIHtcbiAgICAgaWYoc3RhdHMuZnBzRHJvcEV2ZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RhdHMuZnBzRHJvcEV2ZW50ID0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdHMuZnBzRHJvcEV2ZW50Kys7XG4gICAgICB9XG4gICAgICBzdGF0cy5mcHNUb3RhbERyb3BwZWRGcmFtZXMgPSBkYXRhLnRvdGFsRHJvcHBlZEZyYW1lcztcbiAgICB9XG4gIH1cblxuICBnZXQgc3RhdHMoKSB7XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdGhpcy5fc3RhdHMubGFzdFBvcyA9IHRoaXMudmlkZW8uY3VycmVudFRpbWUudG9GaXhlZCgzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0YXRzO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0YXRzSGFuZGxlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCgpe31cbmxldCBmYWtlTG9nZ2VyID0ge1xuICBsb2c6IG5vb3AsXG4gIHdhcm46IG5vb3AsXG4gIGluZm86IG5vb3AsXG4gIGVycm9yOiBub29wXG59O1xubGV0IGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcblxuZXhwb3J0IHZhciBlbmFibGVMb2dzID0gZnVuY3Rpb24oZGVidWcpIHtcbiAgaWYgKGRlYnVnID09PSB0cnVlIHx8IHR5cGVvZiBkZWJ1ZyAgICAgICA9PT0gJ29iamVjdCcpIHtcbiAgICBleHBvcnRlZExvZ2dlci5sb2cgICA9IGRlYnVnLmxvZyAgID8gZGVidWcubG9nLmJpbmQoZGVidWcpICAgOiBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLmluZm8gID0gZGVidWcuaW5mbyAgPyBkZWJ1Zy5pbmZvLmJpbmQoZGVidWcpICA6IGNvbnNvbGUuaW5mby5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLmVycm9yID0gZGVidWcuZXJyb3IgPyBkZWJ1Zy5lcnJvci5iaW5kKGRlYnVnKSA6IGNvbnNvbGUuZXJyb3IuYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci53YXJuICA9IGRlYnVnLndhcm4gID8gZGVidWcud2Fybi5iaW5kKGRlYnVnKSAgOiBjb25zb2xlLndhcm4uYmluZChjb25zb2xlKTtcblxuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG9uJ3QgYWxsb3cgdG8gdXNlIGJpbmQgb24gY29uc29sZSBvYmplY3QgYW55d2F5XG4gICAgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICBleHBvcnRlZExvZ2dlci5sb2coKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyAgID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmluZm8gID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmVycm9yID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gID0gbm9vcDtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICB9XG59O1xuZXhwb3J0IHZhciBsb2dnZXIgPSBleHBvcnRlZExvZ2dlcjtcbiIsIiAvKlxuICAqIFhociBiYXNlZCBMb2FkZXJcbiAgKlxuICAqL1xuXG5pbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFhockxvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuYWJvcnQoKTtcbiAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICBpZih0aGlzLmxvYWRlciAmJnRoaXMubG9hZGVyLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHRoaXMuc3RhdHMuYWJvcnRlZCA9IHRydWU7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICBpZih0aGlzLnRpbWVvdXRIYW5kbGUpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKHVybCxyZXNwb25zZVR5cGUsb25TdWNjZXNzLG9uRXJyb3Isb25UaW1lb3V0LHRpbWVvdXQsbWF4UmV0cnkscmV0cnlEZWxheSxvblByb2dyZXNzPW51bGwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLm9uU3VjY2VzcyA9IG9uU3VjY2VzcztcbiAgICB0aGlzLm9uUHJvZ3Jlc3MgPSBvblByb2dyZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy5zdGF0cyA9IHsgdHJlcXVlc3Q6bmV3IERhdGUoKSwgcmV0cnk6MH07XG4gICAgdGhpcy50aW1lb3V0ID0gdGltZW91dDtcbiAgICB0aGlzLm1heFJldHJ5ID0gbWF4UmV0cnk7XG4gICAgdGhpcy5yZXRyeURlbGF5ID0gcmV0cnlEZWxheTtcbiAgICB0aGlzLnRpbWVvdXRIYW5kbGUgPSB3aW5kb3cuc2V0VGltZW91dCh0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksdGltZW91dCk7XG4gICAgdGhpcy5sb2FkSW50ZXJuYWwoKTtcbiAgfVxuXG4gIGxvYWRJbnRlcm5hbCgpIHtcbiAgICB2YXIgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkID0gIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub25lcnJvciA9IHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vcGVuKCdHRVQnLCB0aGlzLnVybCAsIHRydWUpO1xuICAgIHhoci5yZXNwb25zZVR5cGUgPSB0aGlzLnJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLnN0YXRzLnRmaXJzdCA9IG51bGw7XG4gICAgdGhpcy5zdGF0cy5sb2FkZWQgPSAwO1xuICAgIHhoci5zZW5kKCk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICB0aGlzLnN0YXRzLnRsb2FkID0gbmV3IERhdGUoKTtcbiAgICB0aGlzLm9uU3VjY2VzcyhldmVudCx0aGlzLnN0YXRzKTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIGlmKHRoaXMuc3RhdHMucmV0cnkgPCB0aGlzLm1heFJldHJ5KSB7XG4gICAgICBsb2dnZXIud2FybihgJHtldmVudC50eXBlfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9LCByZXRyeWluZyBpbiAke3RoaXMucmV0cnlEZWxheX0uLi5gKTtcbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkSW50ZXJuYWwuYmluZCh0aGlzKSx0aGlzLnJldHJ5RGVsYXkpO1xuICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgdGhpcy5yZXRyeURlbGF5PU1hdGgubWluKDIqdGhpcy5yZXRyeURlbGF5LDY0MDAwKTtcbiAgICAgIHRoaXMuc3RhdHMucmV0cnkrKztcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgICAgbG9nZ2VyLmVycm9yKGAke2V2ZW50LnR5cGV9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgICB0aGlzLm9uRXJyb3IoZXZlbnQpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWR0aW1lb3V0KGV2ZW50KSB7XG4gICAgbG9nZ2VyLndhcm4oYHRpbWVvdXQgd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfWAgKTtcbiAgICB0aGlzLm9uVGltZW91dChldmVudCx0aGlzLnN0YXRzKTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcyhldmVudCkge1xuICAgIHZhciBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgaWYoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBuZXcgRGF0ZSgpO1xuICAgIH1cbiAgICBzdGF0cy5sb2FkZWQgPSBldmVudC5sb2FkZWQ7XG4gICAgaWYodGhpcy5vblByb2dyZXNzKSB7XG4gICAgICB0aGlzLm9uUHJvZ3Jlc3MoZXZlbnQsIHN0YXRzKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgWGhyTG9hZGVyO1xuIl19
