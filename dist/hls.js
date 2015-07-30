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
    this.onmp = this.onManifestParsed.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onis = this.onInitSegment.bind(this);
    this.onfpg = this.onFragmentParsing.bind(this);
    this.onfp = this.onFragmentParsed.bind(this);
    this.onerr = this.onError.bind(this);
    this.ontick = this.tick.bind(this);
    _observer2['default'].on(_events2['default'].MSE_ATTACHED, this.onmse);
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
          this.startPosition = this.lastCurrentTime;
          this.state = this.IDLE;
        } else {
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
          this.hls.nextLoadLevel = this.startLevel;
          this.state = this.WAITING_LEVEL;
          this.loadedmetadata = false;
          break;
        case this.IDLE:
          // handle end of immediate switching if needed
          if (this.immediateSwitch) {
            this.immediateLevelSwitchEnd();
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
                  //logger.log(`level/sn/sliding/start/end/bufEnd:${level}/${frag.sn}/${sliding}/${start.toFixed(3)}/${(start+frag.duration).toFixed(3)}/${bufferEnd.toFixed(3)}`);
                }
                start += drift;
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
            _utilsLogger.logger.log('Loading       ' + _frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level + ', bufferEnd:' + bufferEnd.toFixed(3));
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
                _observer2['default'].trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR, fatal: false, frag: this.frag });
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
            if (this.sourceBuffer.audio && this.sourceBuffer.audio.updating || this.sourceBuffer.video && this.sourceBuffer.video.updating) {} else if (this.mp4segments.length) {
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
              this.mediaSource.endOfStream();
            }
          }
        }
      }
    }
  }, {
    key: 'flushBuffer',

    /*
      abort any buffer append in progress, and flush all buffered data
      return true once everything has been flushed.
      sourceBuffer.abort() and sourceBuffer.remove() are asynchronous operations
      the idea is to call this function from tick() timer and call it again until all resources have been cleaned
      the timer is rearmed upon sourceBuffer updateend() event, so this should be optimal
    */
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
  }, {
    key: 'immediateLevelSwitch',

    /*
      on immediate level switch :
       - pause playback if playing
       - cancel any pending load request
       - and trigger a buffer flush
    */
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
  }, {
    key: 'immediateLevelSwitchEnd',

    /*
       on immediate level switch end, after new fragment has been buffered :
        - nudge video decoder by slightly adjusting video currentTime
        - resume the playback if needed
    */
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
        this.frag.drift = data.startPTS - this.frag.start;
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
    get: function () {
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
    get: function () {
      if (this.video) {
        // first get end range of current fragment
        return this.followingBufferRange(this.getBufferRange(this.video.currentTime));
      } else {
        return null;
      }
    }
  }, {
    key: 'nextLevel',
    get: function () {
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

//logger.log('sb append in progress');
// check if any MP4 segments left to append

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
    get: function () {
      return this._levels;
    }
  }, {
    key: 'level',
    get: function () {
      return this._level;
    },
    set: function (newLevel) {
      if (this._level !== newLevel || this._levels[newLevel].details === undefined) {
        this.setLevelInternal(newLevel);
      }
    }
  }, {
    key: 'manualLevel',
    get: function () {
      return this._manualLevel;
    },
    set: function (newLevel) {
      this._manualLevel = newLevel;
      if (newLevel !== -1) {
        this.level = newLevel;
      }
    }
  }, {
    key: 'autoLevelCapping',

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/
    get: function () {
      return this._autoLevelCapping;
    },

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    set: function (newLevel) {
      this._autoLevelCapping = newLevel;
    }
  }, {
    key: 'firstLevel',
    get: function () {
      return this._firstLevel;
    },
    set: function (newLevel) {
      this._firstLevel = newLevel;
    }
  }, {
    key: 'startLevel',
    get: function () {
      if (this._startLevel === undefined) {
        return this._firstLevel;
      } else {
        return this._startLevel;
      }
    },
    set: function (newLevel) {
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

  _createClass(ExpGolomb, [{
    key: 'loadWord',

    // ():void
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
  }, {
    key: 'skipBits',

    // (count:int):void
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
  }, {
    key: 'readBits',

    // (size:int):uint
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
  }, {
    key: 'skipLZ',

    // ():uint
    value: function skipLZ() {
      var leadingZeroCount; // :uint
      for (leadingZeroCount = 0; leadingZeroCount < this.bitsAvailable; ++leadingZeroCount) {
        if (0 !== (this.word & 2147483648 >>> leadingZeroCount)) {
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
  }, {
    key: 'skipUEG',

    // ():void
    value: function skipUEG() {
      this.skipBits(1 + this.skipLZ());
    }
  }, {
    key: 'skipEG',

    // ():void
    value: function skipEG() {
      this.skipBits(1 + this.skipLZ());
    }
  }, {
    key: 'readUEG',

    // ():uint
    value: function readUEG() {
      var clz = this.skipLZ(); // :uint
      return this.readBits(clz + 1) - 1;
    }
  }, {
    key: 'readEG',

    // ():int
    value: function readEG() {
      var valu = this.readUEG(); // :int
      if (1 & valu) {
        // the number is odd if the low order bit is set
        return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
      } else {
        return -1 * (valu >>> 1); // divide by two then make it negative
      }
    }
  }, {
    key: 'readBoolean',

    // Some convenience functions
    // :Boolean
    value: function readBoolean() {
      return 1 === this.readBits(1);
    }
  }, {
    key: 'readUByte',

    // ():int
    value: function readUByte() {
      return this.readBits(8);
    }
  }, {
    key: 'skipScalingList',

    /**
     * Advance the ExpGolomb decoder past a scaling list. The scaling
     * list is optionally transmitted as part of a sequence parameter
     * set and is not relevant to transmuxing.
     * @param count {number} the number of entries in this scaling list
     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
     */
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
  }, {
    key: 'readSPS',

    /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
     * @param data {Uint8Array} the bytes of a sequence parameter set
     * @return {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */
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
  }, {
    key: 'push',

    // feed incoming data to the front of the parsing pipeline
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
        if (data[start] === 71) {
          stt = !!(data[start + 1] & 64);
          // pid is a 13-bit field starting at the last bit of TS[1]
          pid = ((data[start + 1] & 31) << 8) + data[start + 2];
          atf = (data[start + 3] & 48) >> 4;
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
              avcData.data.push(data.subarray(offset, start + 188));
              avcData.size += start + 188 - offset;
            } else if (pid === aacId) {
              if (stt) {
                if (aacData) {
                  this._parseAACPES(this._parsePES(aacData));
                }
                aacData = { data: [], size: 0 };
              }
              aacData.data.push(data.subarray(offset, start + 188));
              aacData.size += start + 188 - offset;
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
      this._pmtId = (data[offset + 10] & 31) << 8 | data[offset + 11];
      //logger.log('PMT PID:'  + this._pmtId);
    }
  }, {
    key: '_parsePMT',
    value: function _parsePMT(data, offset) {
      var sectionLength, tableEnd, programInfoLength, pid;
      sectionLength = (data[offset + 1] & 15) << 8 | data[offset + 2];
      tableEnd = offset + 3 + sectionLength - 4;
      // to determine where the table is, we have to figure out how
      // long the program info descriptors are
      programInfoLength = (data[offset + 10] & 15) << 8 | data[offset + 11];

      // advance the offset to the first entry in the mapping table
      offset += 12 + programInfoLength;
      while (offset < tableEnd) {
        pid = (data[offset + 1] & 31) << 8 | data[offset + 2];
        switch (data[offset]) {
          // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
          case 15:
            //logger.log('AAC PID:'  + pid);
            this._aacId = pid;
            this._aacTrack.id = pid;
            break;
          // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
          case 27:
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
        offset += ((data[offset + 3] & 15) << 8 | data[offset + 4]) + 5;
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
        if (pesFlags & 192) {
          /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
              as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
              as Bitwise operators treat their operands as a sequence of 32 bits */
          pesPts = (frag[9] & 14) * 536870912 + // 1 << 29
          (frag[10] & 255) * 4194304 + // 1 << 22
          (frag[11] & 254) * 16384 + // 1 << 14
          (frag[12] & 255) * 128 + // 1 << 7
          (frag[13] & 254) / 2;
          // check if greater than 2^32 -1
          if (pesPts > 4294967295) {
            // decrement 2^33
            pesPts -= 8589934592;
          }
          if (pesFlags & 64) {
            pesDts = (frag[14] & 14) * 536870912 + // 1 << 29
            (frag[15] & 255) * 4194304 + // 1 << 22
            (frag[16] & 254) * 16384 + // 1 << 14
            (frag[17] & 255) * 128 + // 1 << 7
            (frag[18] & 254) / 2;
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
              unitType = array[i] & 31;
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
        if (data[adtsStartOffset] === 255 && (data[adtsStartOffset + 1] & 240) === 240) {
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
        adtsFrameSize = (data[adtsStartOffset + 3] & 3) << 11;
        // byte 4
        adtsFrameSize |= data[adtsStartOffset + 4] << 3;
        // byte 5
        adtsFrameSize |= (data[adtsStartOffset + 5] & 224) >>> 5;
        adtsHeaderLen = !!(data[adtsStartOffset + 1] & 1) ? 7 : 9;
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
      adtsObjectType = ((data[offset + 2] & 192) >>> 6) + 1;
      adtsSampleingIndex = (data[offset + 2] & 60) >>> 2;
      adtsChanelConfig = (data[offset + 2] & 1) << 2;
      // byte 3
      adtsChanelConfig |= (data[offset + 3] & 192) >>> 6;

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
      config[0] |= (adtsSampleingIndex & 14) >> 1;
      config[1] |= (adtsSampleingIndex & 1) << 7;
      // channelConfiguration
      config[1] |= adtsChanelConfig << 3;
      if (adtsObjectType === 5) {
        // adtsExtensionSampleingIndex
        config[1] |= (adtsExtensionSampleingIndex & 14) >> 1;
        config[2] = (adtsExtensionSampleingIndex & 1) << 7;
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
  function Hls() {
    var config = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Hls);

    var configDefault = {
      autoStartLoad: true,
      debug: false,
      maxBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000,
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
      this.playlistLoader.destroy();
      this.fragmentLoader.destroy();
      this.levelController.destroy();
      this.bufferController.destroy();
      //this.fpsController.destroy();
      this.statsHandler.destroy();
      this.unloadSource();
      this.detachVideo();
      _observer2['default'].removeAllListeners();
    }
  }, {
    key: 'attachVideo',
    value: function attachVideo(video) {
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
      }
      this.onmso = this.onmse = this.onmsc = null;
      if (video) {
        this.video = null;
      }
    }
  }, {
    key: 'loadSource',
    value: function loadSource(url) {
      this.url = url;
      _utilsLogger.logger.log('loadSource:' + url);
      // when attaching to a source URL, trigger a playlist load
      _observer2['default'].trigger(_events2['default'].MANIFEST_LOADING, { url: url });
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      this.bufferController.startLoad();
    }
  }, {
    key: 'recoverMediaError',
    value: function recoverMediaError() {
      _utilsLogger.logger.log('try to recover media Error');
      var video = this.video;
      this.detachVideo();
      this.attachVideo(video);
    }
  }, {
    key: 'unloadSource',
    value: function unloadSource() {
      this.url = null;
    }
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

    /** Return all quality levels **/
    get: function () {
      return this.levelController.levels;
    }
  }, {
    key: 'currentLevel',

    /** Return current playback quality level **/
    get: function () {
      return this.bufferController.currentLevel;
    },

    /* set quality level immediately (-1 for automatic level selection) */
    set: function (newLevel) {
      this.loadLevel = newLevel;
      this.bufferController.immediateLevelSwitch();
    }
  }, {
    key: 'nextLevel',

    /** Return next playback quality level (quality level of next fragment) **/
    get: function () {
      return this.bufferController.nextLevel;
    },

    /* set quality level for next fragment (-1 for automatic level selection) */
    set: function (newLevel) {
      this.loadLevel = newLevel;
      this.bufferController.nextLevelSwitch();
    }
  }, {
    key: 'loadLevel',

    /** Return the quality level of current/last loaded fragment **/
    get: function () {
      return this.levelController.level;
    },

    /* set quality level for current/next loaded fragment (-1 for automatic level selection) */
    set: function (newLevel) {
      this.levelController.manualLevel = newLevel;
    }
  }, {
    key: 'nextLoadLevel',

    /** Return the quality level of next loaded fragment **/
    get: function () {
      return this.levelController.nextLoadLevel();
    },

    /** set quality level of next loaded fragment **/
    set: function (level) {
      this.levelController.level = level;
    }
  }, {
    key: 'firstLevel',

    /** Return first level (index of first level referenced in manifest)
    **/
    get: function () {
      return this.levelController.firstLevel;
    },

    /** set first level (index of first level referenced in manifest)
    **/
    set: function (newLevel) {
      this.levelController.firstLevel = newLevel;
    }
  }, {
    key: 'startLevel',

    /** Return start level (level of first fragment that will be played back)
        if not overrided by user, first level appearing in manifest will be used as start level
        if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
    **/
    get: function () {
      return this.levelController.startLevel;
    },

    /** set  start level (level of first fragment that will be played back)
        if not overrided by user, first level appearing in manifest will be used as start level
        if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
    **/
    set: function (newLevel) {
      this.levelController.startLevel = newLevel;
    }
  }, {
    key: 'autoLevelCapping',

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/
    get: function () {
      return this.levelController.autoLevelCapping;
    },

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    set: function (newLevel) {
      this.levelController.autoLevelCapping = newLevel;
    }
  }, {
    key: 'autoLevelEnabled',

    /* check if we are in automatic level selection mode */
    get: function () {
      return this.levelController.manualLevel === -1;
    }
  }, {
    key: 'manualLevel',

    /* return manual level */
    get: function () {
      return this.levelController.manualLevel;
    }
  }, {
    key: 'stats',

    /* return playback session stats */
    get: function () {
      return this.statsHandler.stats;
    }
  }], [{
    key: 'isSupported',
    value: function isSupported() {
      return window.MediaSource && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
    }
  }, {
    key: 'Events',
    get: function () {
      return _events2['default'];
    }
  }, {
    key: 'ErrorTypes',
    get: function () {
      return _errors.ErrorTypes;
    }
  }, {
    key: 'ErrorDetails',
    get: function () {
      return _errors.ErrorDetails;
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
      MP4.VIDEO_HDLR = new Uint8Array([0, // version 0
      0, 0, 0, // flags
      0, 0, 0, 0, // pre_defined
      118, 105, 100, 101, // handler_type: 'vide'
      0, 0, 0, 0, // reserved
      0, 0, 0, 0, // reserved
      0, 0, 0, 0, // reserved
      86, 105, 100, 101, 111, 72, 97, 110, 100, 108, 101, 114, 0 // name: 'VideoHandler'
      ]);
      MP4.AUDIO_HDLR = new Uint8Array([0, // version 0
      0, 0, 0, // flags
      0, 0, 0, 0, // pre_defined
      115, 111, 117, 110, // handler_type: 'soun'
      0, 0, 0, 0, // reserved
      0, 0, 0, 0, // reserved
      0, 0, 0, 0, // reserved
      83, 111, 117, 110, 100, 72, 97, 110, 100, 108, 101, 114, 0 // name: 'SoundHandler'
      ]);
      MP4.HDLR_TYPES = {
        'video': MP4.VIDEO_HDLR,
        'audio': MP4.AUDIO_HDLR
      };
      MP4.DREF = new Uint8Array([0, // version 0
      0, 0, 0, // flags
      0, 0, 0, 1, // entry_count
      0, 0, 0, 12, // entry_size
      117, 114, 108, 32, // 'url' type
      0, // version 0
      0, 0, 1 // entry_flags
      ]);
      MP4.STCO = new Uint8Array([0, // version
      0, 0, 0, // flags
      0, 0, 0, 0 // entry_count
      ]);
      MP4.STSC = MP4.STCO;
      MP4.STTS = MP4.STCO;
      MP4.STSZ = new Uint8Array([0, // version
      0, 0, 0, // flags
      0, 0, 0, 0, // sample_size
      0, 0, 0, 0]);
      MP4.VMHD = new Uint8Array([0, // version
      0, 0, 1, // flags
      0, 0, // graphicsmode
      0, 0, 0, 0, 0, 0 // opcolor
      ]);
      MP4.SMHD = new Uint8Array([0, // version
      0, 0, 0, // flags
      0, 0, // balance
      0, 0 // reserved
      ]);

      MP4.STSD = new Uint8Array([0, // version 0
      0, 0, 0, // flags
      0, 0, 0, 1]); // entry_count

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
      return MP4.box(MP4.types.mdhd, new Uint8Array([0, // version 0
      0, 0, 0, // flags
      0, 0, 0, 2, // creation_time
      0, 0, 0, 3, // modification_time
      timescale >> 24 & 255, timescale >> 16 & 255, timescale >> 8 & 255, timescale & 255, duration >> 24, duration >> 16 & 255, duration >> 8 & 255, duration & 255, // duration
      85, 196, // 'und' language (undetermined)
      0, 0]));
    }
  }, {
    key: 'mdia',
    value: function mdia(track) {
      return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
    }
  }, {
    key: 'mfhd',
    value: function mfhd(sequenceNumber) {
      return MP4.box(MP4.types.mfhd, new Uint8Array([0, 0, 0, 0, sequenceNumber >> 24, sequenceNumber >> 16 & 255, sequenceNumber >> 8 & 255, sequenceNumber & 255]));
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
  }, {
    key: 'moov',

    /**
     * @param tracks... (optional) {array} the tracks associated with this movie
     */
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
      var bytes = new Uint8Array([0, // version 0
      0, 0, 0, // flags
      0, 0, 0, 1, // creation_time
      0, 0, 0, 2, // modification_time
      timescale >> 24 & 255, timescale >> 16 & 255, timescale >> 8 & 255, timescale & 255, // timescale
      duration >> 24 & 255, duration >> 16 & 255, duration >> 8 & 255, duration & 255, // duration
      0, 1, 0, 0, // 1.0 rate
      1, 0, // 1.0 volume
      0, 0, // reserved
      0, 0, 0, 0, // reserved
      0, 0, 0, 0, // reserved
      0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0, // transformation: unity matrix
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // pre_defined
      255, 255, 255, 255 // next_track_ID
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
        sps.push(track.sps[i].byteLength >>> 8 & 255);
        sps.push(track.sps[i].byteLength & 255); // sequenceParameterSetLength
        sps = sps.concat(Array.prototype.slice.call(track.sps[i])); // SPS
      }

      // assemble the PPSs
      for (i = 0; i < track.pps.length; i++) {
        pps.push(track.pps[i].byteLength >>> 8 & 255);
        pps.push(track.pps[i].byteLength & 255);
        pps = pps.concat(Array.prototype.slice.call(track.pps[i]));
      }

      return MP4.box(MP4.types.avc1, new Uint8Array([0, 0, 0, // reserved
      0, 0, 0, // reserved
      0, 1, // data_reference_index
      0, 0, // pre_defined
      0, 0, // reserved
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // pre_defined
      track.width >> 8 & 255, track.width & 255, // width
      track.height >> 8 & 255, track.height & 255, // height
      0, 72, 0, 0, // horizresolution
      0, 72, 0, 0, // vertresolution
      0, 0, 0, 0, // reserved
      0, 1, // frame_count
      19, 118, 105, 100, 101, 111, 106, 115, 45, 99, 111, 110, 116, 114, 105, 98, 45, 104, 108, 115, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // compressorname
      0, 24, // depth = 24
      17, 17]), // pre_defined = -1
      MP4.box(MP4.types.avcC, new Uint8Array([1, // configurationVersion
      track.profileIdc, // AVCProfileIndication
      track.profileCompat, // profile_compatibility
      track.levelIdc, // AVCLevelIndication
      255 // lengthSizeMinusOne, hard-coded to 4 bytes
      ].concat([track.sps.length // numOfSequenceParameterSets
      ]).concat(sps).concat([track.pps.length // numOfPictureParameterSets
      ]).concat(pps))), // "PPS"
      MP4.box(MP4.types.btrt, new Uint8Array([0, 28, 156, 128, // bufferSizeDB
      0, 45, 198, 192, // maxBitrate
      0, 45, 198, 192])) // avgBitrate
      );
    }
  }, {
    key: 'esds',
    value: function esds(track) {
      return new Uint8Array([0, // version 0
      0, 0, 0, // flags

      3, // descriptor_type
      23 + track.config.length, // length
      0, 1, //es_id
      0, // stream_priority

      4, // descriptor_type
      15 + track.config.length, // length
      64, //codec : mpeg4_audio
      21, // stream_type
      0, 0, 0, // buffer_size
      0, 0, 0, 0, // maxBitrate
      0, 0, 0, 0, // avgBitrate

      5 // descriptor_type
      ].concat([track.config.length]).concat(track.config).concat([6, 1, 2])); // GASpecificConfig)); // length + audio config descriptor
    }
  }, {
    key: 'mp4a',
    value: function mp4a(track) {
      return MP4.box(MP4.types.mp4a, new Uint8Array([0, 0, 0, // reserved
      0, 0, 0, // reserved
      0, 1, // data_reference_index
      0, 0, 0, 0, 0, 0, 0, 0, // reserved
      0, track.channelCount, // channelcount
      0, 16, // sampleSize:16bits
      0, 0, 0, 0, // reserved2
      track.audiosamplerate >> 8 & 255, track.audiosamplerate & 255, //
      0, 0]), MP4.box(MP4.types.esds, MP4.esds(track)));
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
      return MP4.box(MP4.types.tkhd, new Uint8Array([0, // version 0
      0, 0, 7, // flags
      0, 0, 0, 0, // creation_time
      0, 0, 0, 0, // modification_time
      track.id >> 24 & 255, track.id >> 16 & 255, track.id >> 8 & 255, track.id & 255, // track_ID
      0, 0, 0, 0, track.duration >> 24, track.duration >> 16 & 255, track.duration >> 8 & 255, track.duration & 255, // duration
      0, 0, 0, 0, 0, 0, 0, 0, // reserved
      0, 0, // layer
      0, 0, // alternate_group
      0, 0, // non-audio track volume
      0, 0, // reserved
      0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0, // transformation: unity matrix
      track.width >> 8 & 255, track.width & 255, 0, 0, // width
      track.height >> 8 & 255, track.height & 255, 0, 0 // height
      ]));
    }
  }, {
    key: 'traf',
    value: function traf(track, baseMediaDecodeTime) {
      var sampleDependencyTable = MP4.sdtp(track);
      return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([0, // version 0
      0, 0, 0, track.id >> 24, track.id >> 16 & 255, track.id >> 8 & 255, track.id & 255])), MP4.box(MP4.types.tfdt, new Uint8Array([0, // version 0
      0, 0, 0, baseMediaDecodeTime >> 24, baseMediaDecodeTime >> 16 & 255, baseMediaDecodeTime >> 8 & 255, baseMediaDecodeTime & 255])), MP4.trun(track, sampleDependencyTable.length + 16 + // tfhd
      16 + // tfdt
      8 + // traf header
      16 + // mfhd
      8 + // moof header
      8), // mdat header
      sampleDependencyTable);
    }
  }, {
    key: 'trak',

    /**
     * Generate a track box.
     * @param track {object} a track definition
     * @return {Uint8Array} the track box
     */
    value: function trak(track) {
      track.duration = track.duration || 4294967295;
      return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
    }
  }, {
    key: 'trex',
    value: function trex(track) {
      return MP4.box(MP4.types.trex, new Uint8Array([0, // version 0
      0, 0, 0, track.id >> 24, track.id >> 16 & 255, track.id >> 8 & 255, track.id & 255, // track_ID
      0, 0, 0, 1, // default_sample_description_index
      0, 0, 0, 0, // default_sample_duration
      0, 0, 0, 0, // default_sample_size
      0, 1, 0, 1 // default_sample_flags
      ]));
    }
  }, {
    key: 'trun',
    value: function trun(track, offset) {
      var samples, sample, i, array;

      samples = track.samples || [];
      array = new Uint8Array(12 + 16 * samples.length);
      offset += 8 + array.byteLength;

      array.set([0, // version 0
      0, 15, 1, // flags
      samples.length >>> 24 & 255, samples.length >>> 16 & 255, samples.length >>> 8 & 255, samples.length & 255, // sample_count
      offset >>> 24 & 255, offset >>> 16 & 255, offset >>> 8 & 255, offset & 255 // data_offset
      ], 0);

      for (i = 0; i < samples.length; i++) {
        sample = samples[i];
        array.set([sample.duration >>> 24 & 255, sample.duration >>> 16 & 255, sample.duration >>> 8 & 255, sample.duration & 255, // sample_duration
        sample.size >>> 24 & 255, sample.size >>> 16 & 255, sample.size >>> 8 & 255, sample.size & 255, // sample_size
        sample.flags.isLeading << 2 | sample.flags.dependsOn, sample.flags.isDependedOn << 6 | sample.flags.hasRedundancy << 4 | sample.flags.paddingValue << 1 | sample.flags.isNonSync, sample.flags.degradPrio & 240 << 8, sample.flags.degradPrio & 15, // sample_flags
        sample.cts >>> 24 & 255, sample.cts >>> 16 & 255, sample.cts >>> 8 & 255, sample.cts & 255 // sample_composition_time_offset
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
// sample_count
// timescale
// flags
// sequence_number
// reserved
// flags
// track_ID
// flags
// baseMediaDecodeTime
// flags

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
  }, {
    key: 'onManifestParsed',

    // reset stats on manifest parsed
    value: function onManifestParsed(event, data) {
      this._stats = { tech: 'hls.js', levelNb: data.levels.length };
    }
  }, {
    key: 'onFragmentChanged',

    // on fragment changed is triggered whenever playback of a new fragment is starting ...
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
  }, {
    key: 'onFragmentBuffered',

    // triggered each time a new fragment is buffered
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
    get: function () {
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
      var onProgress = arguments[8] === undefined ? null : arguments[8];

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
        _utilsLogger.logger.warn('' + event.type + ' while loading ' + this.url + ', retrying in ' + this.retryDelay + '...');
        this.destroy();
        window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
        // exponential backoff
        this.retryDelay = Math.min(2 * this.retryDelay, 64000);
        this.stats.retry++;
      } else {
        window.clearTimeout(this.timeoutHandle);
        _utilsLogger.logger.error('' + event.type + ' while loading ' + this.url);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2Vycm9ycy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZXZlbnRzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9obHMuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9mcmFnbWVudC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL29ic2VydmVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9yZW11eC9tcDQtZ2VuZXJhdG9yLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9zdGF0cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvbG9nZ2VyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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QUFDdEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsUUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsRUFBSSxFQUFFLEVBQUksRUFBRSxHQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxDQUFJO09BQzdCLENBQUMsQ0FBQztBQUNILFNBQUcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FDOUIsQ0FBSTtBQUNKLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUNoQixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7QUFDdEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsUUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsRUFBSSxFQUFFLEVBQUksRUFBRSxHQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxDQUFJO09BQzdCLENBQUMsQ0FBQztBQUNILFNBQUcsQ0FBQyxVQUFVLEdBQUc7QUFDZixlQUFPLEVBQUMsR0FBRyxDQUFDLFVBQVU7QUFDdEIsZUFBTyxFQUFDLEdBQUcsQ0FBQyxVQUFVO09BQ3ZCLENBQUM7QUFDRixTQUFHLENBQUMsSUFBSSxHQUFHLElBQUksVUFBVSxDQUFDLENBQ3hCLENBQUk7QUFDSixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsT0FBSSxFQUFF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RSxDQUFJO0FBQ3RCLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLEVBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSTtPQUN2QixDQUFDLENBQUM7QUFDTCxhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDdkM7OztXQUVVLGNBQUMsS0FBSyxFQUFFO0FBQ2pCLFVBQ0UsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLElBQUksRUFBRTtVQUM3QixLQUFLLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7VUFDMUMsS0FBSztVQUNMLENBQUMsQ0FBQzs7Ozs7QUFLSixXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDbkMsYUFBSyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDekIsYUFBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxBQUFDLEtBQUssQ0FBQyxTQUFTLElBQUksQ0FBQyxHQUNqQyxLQUFLLENBQUMsWUFBWSxJQUFJLENBQUMsQUFBQyxHQUN4QixLQUFLLENBQUMsYUFBYSxBQUFDLENBQUM7T0FDekI7O0FBRUQsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUNsQixLQUFLLENBQUMsQ0FBQztLQUNuQjs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUNsQixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUNmLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUNqQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFDakMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQ2pDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDL0M7OztXQUVVLGNBQUMsS0FBSyxFQUFFO0FBQ2pCLFVBQUksR0FBRyxHQUFHLEVBQUU7VUFBRSxHQUFHLEdBQUcsRUFBRTtVQUFFLENBQUMsQ0FBQzs7QUFFMUIsV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNyQyxXQUFHLENBQUMsSUFBSSxDQUFDLEFBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxHQUFJLEdBQUksQ0FBQyxDQUFDO0FBQ2pELFdBQUcsQ0FBQyxJQUFJLENBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEdBQUcsR0FBSSxDQUFFLENBQUM7QUFDM0MsV0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQzVEOzs7QUFHRCxXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLFdBQUcsQ0FBQyxJQUFJLENBQUMsQUFBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsS0FBSyxDQUFDLEdBQUksR0FBSSxDQUFDLENBQUM7QUFDakQsV0FBRyxDQUFDLElBQUksQ0FBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsR0FBRyxHQUFJLENBQUUsQ0FBQztBQUMzQyxXQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDNUQ7O0FBRUQsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksVUFB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QUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO09BQzVELE1BQU07QUFDTCxlQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7T0FDNUQ7S0FDRjs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksVUFBVSxDQUFDLENBQzVDLENBQUk7QUFDSixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLEFBQUMsV0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUksR0FBSSxFQUN2QixBQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFJLEdBQUksRUFDdkIsQUFBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBSSxHQUFJLEVBQ3RCLEtBQUssQ0FBQyxFQUFFLEdBQUcsR0FBSTtBQUNmLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDckIsS0FBSyxDQUFDLFFBQVEsSUFBSSxFQUFFLEVBQ3JCLEFBQUMsS0FBSyxDQUFDLFFBQVEsSUFBSSxFQUFFLEdBQUksR0FBSSxFQUM3QixBQUFDLEtBQUssQ0FBQyxRQUFRLElBQUssQ0FBQyxHQUFJLEdBQUksRUFDN0IsS0FBSyxDQUFDLFFBQVEsR0FBRyxHQUFJO0FBQ3JCLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSTtBQUNWLE9BQUksRUFBRSxDQUFJO0FBQ1YsT0FBSSxFQUFFLENBQUk7QUFDVixPQUFJLEVBQUUsQ0FBSTtBQUNWLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLEFBQUMsV0FBSyxDQUFDLEtBQUssSUFBSSxDQUFDLEdBQUksR0FBSSxFQUN6QixLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUksRUFDbEIsQ0FBSSxFQUFFLENBQUk7QUFDVixBQUFDLFdBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFJLEdBQUksRUFDMUIsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFJLEVBQ25CLENBQUksRUFBRSxDQUFJO09BQ1gsQ0FBQyxDQUFDLENBQUM7S0FDTDs7O1dBRVUsY0FBQyxLQUFLLEVBQUMsbUJBQW1CLEVBQUU7QUFDckMsVUFBSSxxQkFBcUIsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzVDLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFDbEIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxDQUNyQyxDQUFJO0FBQ0osT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ2YsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQ2YsQUFBQyxLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBSSxHQUFJLEVBQ3ZCLEFBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUksR0FBSSxFQUNyQixLQUFLLENBQUMsRUFBRSxHQUFHLEdBQUksQ0FDakIsQ0FBQyxDQUFDLEVBQ0gsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxDQUNyQyxDQUFJO0FBQ0osT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ2YsbUJBQW1CLElBQUcsRUFBRSxFQUN6QixBQUFDLG1CQUFtQixJQUFJLEVBQUUsR0FBSSxHQUFJLEVBQ2xDLEFBQUMsbUJBQW1CLElBQUksQ0FBQyxHQUFJLEdBQUksRUFDaEMsbUJBQW1CLEdBQUcsR0FBSSxDQUM1QixDQUFDLENBQUMsRUFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFDVCxxQkFBcUIsQ0FBQyxNQUFNLEdBQzVCLEVBQUU7QUFDRixRQUFFO0FBQ0YsT0FBQztBQUNELFFBQUU7QUFDRixPQUFDO0FBQ0QsT0FBQyxDQUFDO0FBQ1AsMkJBQXFCLENBQUMsQ0FBQztLQUNuQzs7Ozs7Ozs7O1dBT1UsY0FBQyxLQUFLLEVBQUU7QUFDakIsV0FBSyxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxJQUFJLFVBQVUsQ0FBQztBQUM5QyxhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQ2xCLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQ2YsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQzdCOzs7V0FFVSxjQUFDLEtBQUssRUFBRTtBQUNqQixhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxVQUFVLENBQUMsQ0FDNUMsQ0FBSTtBQUNKLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUNoQixLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFDZixBQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFJLEdBQUksRUFDdkIsQUFBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBSSxHQUFJLEVBQ3JCLEtBQUssQ0FBQyxFQUFFLEdBQUcsR0FBSTtBQUNmLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7T0FDdkIsQ0FBQyxDQUFDLENBQUM7S0FDTDs7O1dBRVUsY0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFO0FBQ3pCLFVBQUksT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDOztBQUU5QixhQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUM7QUFDOUIsV0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLEVBQUUsR0FBSSxFQUFFLEdBQUcsT0FBTyxDQUFDLE1BQU0sQUFBQyxDQUFDLENBQUM7QUFDbkQsWUFBTSxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDOztBQUUvQixXQUFLLENBQUMsR0FBRyxDQUFDLENBQ1IsQ0FBSTtBQUNKLE9BQUksRUFBRSxFQUFJLEVBQUUsQ0FBSTtBQUNoQixBQUFDLGFBQU8sQ0FBQyxNQUFNLEtBQUssRUFBRSxHQUFJLEdBQUksRUFDOUIsQUFBQyxPQUFPLENBQUMsTUFBTSxLQUFLLEVBQUUsR0FBSSxHQUFJLEVBQzlCLEFBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEdBQUksR0FBSSxFQUM3QixPQUFPLENBQUMsTUFBTSxHQUFHLEdBQUk7QUFDckIsQUFBQyxZQUFNLEtBQUssRUFBRSxHQUFJLEdBQUksRUFDdEIsQUFBQyxNQUFNLEtBQUssRUFBRSxHQUFJLEdBQUksRUFDdEIsQUFBQyxNQUFNLEtBQUssQ0FBQyxHQUFJLEdBQUksRUFDckIsTUFBTSxHQUFHLEdBQUk7QUFBQSxPQUNkLEVBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRUwsV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ25DLGNBQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsYUFBSyxDQUFDLEdBQUcsQ0FBQyxDQUNSLEFBQUMsTUFBTSxDQUFDLFFBQVEsS0FBSyxFQUFFLEdBQUksR0FBSSxFQUMvQixBQUFDLE1BQU0sQ0FBQyxRQUFRLEtBQUssRUFBRSxHQUFJLEdBQUksRUFDL0IsQUFBQyxNQUFNLENBQUMsUUFBUSxLQUFLLENBQUMsR0FBSSxHQUFJLEVBQzlCLE1BQU0sQ0FBQyxRQUFRLEdBQUcsR0FBSTtBQUN0QixBQUFDLGNBQU0sQ0FBQyxJQUFJLEtBQUssRUFBRSxHQUFJLEdBQUksRUFDM0IsQUFBQyxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUUsR0FBSSxHQUFJLEVBQzNCLEFBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUksR0FBSSxFQUMxQixNQUFNLENBQUMsSUFBSSxHQUFHLEdBQUk7QUFDbEIsQUFBQyxjQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLEdBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQ3RELEFBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLElBQUksQ0FBQyxHQUM1QixNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsSUFBSSxDQUFDLEFBQUMsR0FDaEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLElBQUksQ0FBQyxBQUFDLEdBQ2hDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUN4QixNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFJLElBQUksQ0FBQyxFQUNuQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxFQUFJO0FBQzlCLEFBQUMsY0FBTSxDQUFDLEdBQUcsS0FBSyxFQUFFLEdBQUksR0FBSSxFQUMxQixBQUFDLE1BQU0sQ0FBQyxHQUFHLEtBQUssRUFBRSxHQUFJLEdBQUksRUFDMUIsQUFBQyxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBSSxHQUFJLEVBQ3pCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBSTtBQUFBLFNBQ2xCLEVBQUMsRUFBRSxHQUFDLEVBQUUsR0FBQyxDQUFDLENBQUMsQ0FBQztPQUNaO0FBQ0QsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3ZDOzs7V0FFaUIscUJBQUMsTUFBTSxFQUFFOztBQUV6QixVQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRTtBQUNiLFdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztPQUNaO0FBQ0QsVUFDRSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7VUFDeEIsTUFBTSxDQUFDOztBQUVULFlBQU0sR0FBRyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDaEUsWUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckIsWUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUN2QyxhQUFPLE1BQU0sQ0FBQztLQUNmOzs7U0Fsa0JHLEdBQUc7OztxQkFxa0JNLEdBQUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7c0JDcGtCZSxVQUFVOzs7O3dCQUNWLFlBQVk7Ozs7SUFFdEMsWUFBWTtBQUVOLFdBRk4sWUFBWSxDQUVMLEdBQUcsRUFBRTswQkFGWixZQUFZOztBQUdmLFFBQUksQ0FBQyxHQUFHLEdBQUMsR0FBRyxDQUFDO0FBQ2IsUUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzdDLFFBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QyxRQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDL0MsUUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsOEJBQThCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzdELFFBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckMsUUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN4QywwQkFBUyxFQUFFLENBQUMsb0JBQU0sZUFBZSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QywwQkFBUyxFQUFFLENBQUMsb0JBQU0sYUFBYSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM1QywwQkFBUyxFQUFFLENBQUMsb0JBQU0sWUFBWSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMzQywwQkFBUyxFQUFFLENBQUMsb0JBQU0sS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNyQywwQkFBUyxFQUFFLENBQUMsb0JBQU0sMkJBQTJCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzVELDBCQUFTLEVBQUUsQ0FBQyxvQkFBTSxRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0dBQzFDOztlQWhCSSxZQUFZOztXQWtCVixtQkFBRztBQUNSLDRCQUFTLEdBQUcsQ0FBQyxvQkFBTSxlQUFlLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9DLDRCQUFTLEdBQUcsQ0FBQyxvQkFBTSxhQUFhLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzdDLDRCQUFTLEdBQUcsQ0FBQyxvQkFBTSxZQUFZLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzVDLDRCQUFTLEdBQUcsQ0FBQyxvQkFBTSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RDLDRCQUFTLEdBQUcsQ0FBQyxvQkFBTSwyQkFBMkIsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDN0QsNEJBQVMsR0FBRyxDQUFDLG9CQUFNLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDM0M7OztXQUVVLHFCQUFDLEtBQUssRUFBRTtBQUNqQixVQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztLQUNwQjs7O1dBRVUsdUJBQUc7QUFDWixVQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztLQUNuQjs7Ozs7V0FHZSwwQkFBQyxLQUFLLEVBQUMsSUFBSSxFQUFFO0FBQzNCLFVBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxJQUFJLEVBQUcsUUFBUSxFQUFFLE9BQU8sRUFBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBQyxDQUFDO0tBQ2hFOzs7OztXQUdnQiwyQkFBQyxLQUFLLEVBQUMsSUFBSSxFQUFFO0FBQzVCLFVBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNO1VBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSztVQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztBQUNoRixVQUFHLEtBQUssRUFBRTtBQUNSLFlBQUcsS0FBSyxDQUFDLFVBQVUsS0FBSyxTQUFTLEVBQUU7QUFDakMsZUFBSyxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7U0FDMUI7QUFDRCxZQUFHLFNBQVMsRUFBRTtBQUNaLGNBQUcsS0FBSyxDQUFDLGVBQWUsRUFBRTtBQUN4QixpQkFBSyxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUMsS0FBSyxDQUFDLENBQUM7QUFDeEQsaUJBQUssQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3hELGlCQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7QUFDeEIsZ0JBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxLQUFLLEtBQUssS0FBSyxDQUFDLGFBQWEsRUFBRTtBQUN0RCxtQkFBSyxDQUFDLGVBQWUsRUFBRSxDQUFDO2FBQ3pCO1dBQ0YsTUFBTTtBQUNMLGlCQUFLLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBQ2hELGlCQUFLLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQztBQUMxQixpQkFBSyxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUM7QUFDMUIsZ0JBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1dBQ3ZCO0FBQ0QsY0FBSSxDQUFDLFlBQVksSUFBRSxLQUFLLENBQUM7QUFDekIsZUFBSyxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBQyxJQUFJLENBQUMsWUFBWSxHQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBQyxJQUFJLENBQUM7QUFDbkYsZUFBSyxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7U0FDN0IsTUFBTTtBQUNMLGNBQUcsS0FBSyxDQUFDLGlCQUFpQixFQUFFO0FBQzFCLGlCQUFLLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBQyxLQUFLLENBQUMsQ0FBQztBQUM1RCxpQkFBSyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUMsS0FBSyxDQUFDLENBQUM7QUFDNUQsaUJBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0FBQzFCLGdCQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsSUFBSSxLQUFLLEtBQUssS0FBSyxDQUFDLGVBQWUsRUFBRTtBQUN6RCxtQkFBSyxDQUFDLGlCQUFpQixFQUFFLENBQUM7YUFDM0I7V0FDRixNQUFNO0FBQ0wsaUJBQUssQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7QUFDcEQsaUJBQUssQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLENBQUM7QUFDNUIsaUJBQUssQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLENBQUM7V0FDN0I7QUFDRCxlQUFLLENBQUMsZUFBZSxHQUFHLEtBQUssQ0FBQztTQUMvQjtBQUNELFlBQUksQ0FBQyxhQUFhLEdBQUcsU0FBUyxDQUFDO09BQ2hDO0tBQ0Y7Ozs7O1dBR2lCLDRCQUFDLEtBQUssRUFBQyxJQUFJLEVBQUU7QUFDN0IsVUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU07VUFBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRO1VBQUUsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUTtVQUFFLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sSUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsQ0FBQztBQUN0TixVQUFHLEtBQUssQ0FBQyxZQUFZLEVBQUU7QUFDckIsYUFBSyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUMsT0FBTyxDQUFDLENBQUM7QUFDOUQsYUFBSyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUMsT0FBTyxDQUFDLENBQUM7QUFDOUQsYUFBSyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUMsT0FBTyxDQUFDLENBQUM7QUFDOUQsYUFBSyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUMsT0FBTyxDQUFDLENBQUM7QUFDOUQsYUFBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUMsT0FBTyxDQUFDLENBQUM7QUFDeEQsYUFBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUMsT0FBTyxDQUFDLENBQUM7QUFDeEQsYUFBSyxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLG1CQUFtQixFQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUMxRixhQUFLLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBQzFGLGFBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQztPQUN0QixNQUFNO0FBQ0wsYUFBSyxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQztBQUN0RCxhQUFLLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDO0FBQ3RELGFBQUssQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUM7QUFDaEQsYUFBSyxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUM7QUFDdkIsYUFBSyxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQztBQUM1QixhQUFLLENBQUMsbUJBQW1CLEdBQUcsS0FBSyxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUM7QUFDbEYsWUFBSSxDQUFDLFVBQVUsR0FBQyxDQUFDLENBQUM7QUFDbEIsWUFBSSxDQUFDLE9BQU8sR0FBQyxDQUFDLENBQUM7QUFDZixZQUFJLENBQUMsVUFBVSxHQUFDLENBQUMsQ0FBQztPQUNuQjtBQUNELFdBQUssQ0FBQyxlQUFlLEdBQUMsT0FBTyxDQUFDO0FBQzlCLFVBQUksQ0FBQyxVQUFVLElBQUUsT0FBTyxDQUFDO0FBQ3pCLFdBQUssQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN0RSxXQUFLLENBQUMsZUFBZSxHQUFDLE9BQU8sQ0FBQztBQUM5QixVQUFJLENBQUMsVUFBVSxJQUFFLE9BQU8sQ0FBQztBQUN6QixXQUFLLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDdEUsV0FBSyxDQUFDLFlBQVksR0FBQyxPQUFPLENBQUM7QUFDM0IsVUFBSSxDQUFDLE9BQU8sSUFBRSxPQUFPLENBQUM7QUFDdEIsV0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ2hFLFdBQUssQ0FBQyxpQkFBaUIsSUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUMzQyxXQUFLLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztLQUN4RDs7O1dBRTZCLDBDQUFHO0FBQy9CLFVBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDeEIsVUFBRyxLQUFLLEVBQUU7QUFDUixZQUFHLEtBQUssQ0FBQyx3QkFBd0IsS0FBSyxTQUFTLEVBQUU7QUFDL0MsZUFBSyxDQUFDLHdCQUF3QixHQUFFLENBQUMsQ0FBQztTQUNuQyxNQUFNO0FBQ0wsZUFBSyxDQUFDLHdCQUF3QixFQUFFLENBQUM7U0FDbEM7T0FDRjtLQUNGOzs7V0FFTSxpQkFBQyxLQUFLLEVBQUMsSUFBSSxFQUFFO0FBQ2xCLFVBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDeEIsVUFBRyxLQUFLLEVBQUU7O0FBRVIsWUFBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFNBQVMsRUFBRTtBQUNwQyxlQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFFLENBQUMsQ0FBQztTQUN4QixNQUFNO0FBQ0wsZUFBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBRSxDQUFDLENBQUM7U0FDeEI7O0FBRUQsWUFBRyxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ2IsY0FBRyxLQUFLLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRTtBQUMvQixpQkFBSyxDQUFDLFVBQVUsR0FBQyxDQUFDLENBQUM7V0FDdEIsTUFBTTtBQUNILGlCQUFLLENBQUMsVUFBVSxJQUFFLENBQUMsQ0FBQztXQUN2QjtTQUNGO09BQ0Y7S0FDRjs7O1dBRVEsbUJBQUMsS0FBSyxFQUFDLElBQUksRUFBRTtBQUNwQixVQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQ3hCLFVBQUcsS0FBSyxFQUFFO0FBQ1QsWUFBRyxLQUFLLENBQUMsWUFBWSxLQUFLLFNBQVMsRUFBRTtBQUNsQyxlQUFLLENBQUMsWUFBWSxHQUFFLENBQUMsQ0FBQztTQUN2QixNQUFNO0FBQ0wsZUFBSyxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ3RCO0FBQ0QsYUFBSyxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztPQUN2RDtLQUNGOzs7U0FFUSxZQUFHO0FBQ1YsVUFBRyxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ2IsWUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQ3pEO0FBQ0QsYUFBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0tBQ3BCOzs7U0F4S0ksWUFBWTs7O3FCQTJLSixZQUFZOzs7O0FDbkwzQixZQUFZLENBQUM7Ozs7O0FBRWIsU0FBUyxJQUFJLEdBQUUsRUFBRTtBQUNqQixJQUFJLFVBQVUsR0FBRztBQUNmLEtBQUcsRUFBRSxJQUFJO0FBQ1QsTUFBSSxFQUFFLElBQUk7QUFDVixNQUFJLEVBQUUsSUFBSTtBQUNWLE9BQUssRUFBRSxJQUFJO0NBQ1osQ0FBQztBQUNGLElBQUksY0FBYyxHQUFHLFVBQVUsQ0FBQzs7QUFFekIsSUFBSSxVQUFVLEdBQUcsU0FBYixVQUFVLENBQVksS0FBSyxFQUFFO0FBQ3RDLE1BQUksS0FBSyxLQUFLLElBQUksSUFBSSxPQUFPLEtBQUssS0FBVyxRQUFRLEVBQUU7QUFDckQsa0JBQWMsQ0FBQyxHQUFHLEdBQUssS0FBSyxDQUFDLEdBQUcsR0FBSyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBSyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN6RixrQkFBYyxDQUFDLElBQUksR0FBSSxLQUFLLENBQUMsSUFBSSxHQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzFGLGtCQUFjLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDM0Ysa0JBQWMsQ0FBQyxJQUFJLEdBQUksS0FBSyxDQUFDLElBQUksR0FBSSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBSSxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQzs7OztBQUkxRixRQUFJO0FBQ0gsb0JBQWMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztLQUNyQixDQUNELE9BQU8sQ0FBQyxFQUFFO0FBQ1Isb0JBQWMsQ0FBQyxHQUFHLEdBQUssSUFBSSxDQUFDO0FBQzVCLG9CQUFjLENBQUMsSUFBSSxHQUFJLElBQUksQ0FBQztBQUM1QixvQkFBYyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7QUFDNUIsb0JBQWMsQ0FBQyxJQUFJLEdBQUksSUFBSSxDQUFDO0tBQzdCO0dBQ0YsTUFDSTtBQUNILGtCQUFjLEdBQUcsVUFBVSxDQUFDO0dBQzdCO0NBQ0YsQ0FBQztRQXRCUyxVQUFVLEdBQVYsVUFBVTtBQXVCZCxJQUFJLE1BQU0sR0FBRyxjQUFjLENBQUM7UUFBeEIsTUFBTSxHQUFOLE1BQU07Ozs7Ozs7Ozs7Ozs7Ozs7OzsyQkM3QmdCLGlCQUFpQjs7SUFFM0MsU0FBUztBQUVILFdBRk4sU0FBUyxHQUVBOzBCQUZULFNBQVM7R0FHYjs7ZUFISSxTQUFTOztXQUtQLG1CQUFHO0FBQ1IsVUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBQ2IsVUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7S0FDcEI7OztXQUVJLGlCQUFHO0FBQ04sVUFBRyxJQUFJLENBQUMsTUFBTSxJQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxLQUFLLENBQUMsRUFBRTtBQUM3QyxZQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFDMUIsWUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztPQUNyQjtBQUNELFVBQUcsSUFBSSxDQUFDLGFBQWEsRUFBRTtBQUNyQixjQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztPQUN6QztLQUNGOzs7V0FFRyxjQUFDLEdBQUcsRUFBQyxZQUFZLEVBQUMsU0FBUyxFQUFDLE9BQU8sRUFBQyxTQUFTLEVBQUMsT0FBTyxFQUFDLFFBQVEsRUFBQyxVQUFVLEVBQWtCO1VBQWpCLFVBQVUsZ0NBQUMsSUFBSTs7QUFDM0YsVUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDZixVQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztBQUNqQyxVQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztBQUMzQixVQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztBQUM3QixVQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztBQUMzQixVQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztBQUN2QixVQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsUUFBUSxFQUFDLElBQUksSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFDLENBQUMsRUFBQyxDQUFDO0FBQzdDLFVBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0FBQ3ZCLFVBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0FBQ3pCLFVBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO0FBQzdCLFVBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLENBQUMsQ0FBQztBQUM1RSxVQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7S0FDckI7OztXQUVXLHdCQUFHO0FBQ2IsVUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO0FBQzdDLFNBQUcsQ0FBQyxNQUFNLEdBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUMsU0FBRyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN4QyxTQUFHLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzlDLFNBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUcsSUFBSSxDQUFDLENBQUM7QUFDakMsU0FBRyxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO0FBQ3JDLFVBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztBQUN6QixVQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDdEIsU0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0tBQ1o7OztXQUVVLHFCQUFDLEtBQUssRUFBRTtBQUNqQixZQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUN4QyxVQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0FBQzlCLFVBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNsQzs7O1dBRVEsbUJBQUMsS0FBSyxFQUFFO0FBQ2YsVUFBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFO0FBQ25DLHFCQXpERSxNQUFNLENBeURELElBQUksTUFBSSxLQUFLLENBQUMsSUFBSSx1QkFBa0IsSUFBSSxDQUFDLEdBQUcsc0JBQWlCLElBQUksQ0FBQyxVQUFVLFNBQU0sQ0FBQztBQUMxRixZQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDZixjQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQzs7QUFFaEUsWUFBSSxDQUFDLFVBQVUsR0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBQyxJQUFJLENBQUMsVUFBVSxFQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2xELFlBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7T0FDcEIsTUFBTTtBQUNMLGNBQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ3hDLHFCQWpFRSxNQUFNLENBaUVELEtBQUssTUFBSSxLQUFLLENBQUMsSUFBSSx1QkFBa0IsSUFBSSxDQUFDLEdBQUcsQ0FBSSxDQUFDO0FBQ3pELFlBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7T0FDckI7S0FDRjs7O1dBRVUscUJBQUMsS0FBSyxFQUFFO0FBQ2pCLG1CQXZFSSxNQUFNLENBdUVILElBQUksNEJBQTBCLElBQUksQ0FBQyxHQUFHLENBQUksQ0FBQztBQUNsRCxVQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDbEM7OztXQUVXLHNCQUFDLEtBQUssRUFBRTtBQUNsQixVQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO0FBQ3ZCLFVBQUcsS0FBSyxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUU7QUFDeEIsYUFBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO09BQzNCO0FBQ0QsV0FBSyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQzVCLFVBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUNsQixZQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztPQUMvQjtLQUNGOzs7U0FsRkksU0FBUzs7O3FCQXFGRCxTQUFTIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuICAgIFxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICBpZiAoY2FjaGVba2V5XS5leHBvcnRzID09PSBmbikge1xuICAgICAgICAgICAgd2tleSA9IGtleTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgXG4gICAgdmFyIHNjYWNoZSA9IHt9OyBzY2FjaGVbd2tleV0gPSB3a2V5O1xuICAgIHNvdXJjZXNbc2tleV0gPSBbXG4gICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZSddLCdyZXF1aXJlKCcgKyBzdHJpbmdpZnkod2tleSkgKyAnKShzZWxmKScpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuICAgIFxuICAgIHZhciBzcmMgPSAnKCcgKyBidW5kbGVGbiArICcpKHsnXG4gICAgICAgICsgT2JqZWN0LmtleXMoc291cmNlcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdpZnkoa2V5KSArICc6WydcbiAgICAgICAgICAgICAgICArIHNvdXJjZXNba2V5XVswXVxuICAgICAgICAgICAgICAgICsgJywnICsgc3RyaW5naWZ5KHNvdXJjZXNba2V5XVsxXSkgKyAnXSdcbiAgICAgICAgICAgIDtcbiAgICAgICAgfSkuam9pbignLCcpXG4gICAgICAgICsgJ30se30sWycgKyBzdHJpbmdpZnkoc2tleSkgKyAnXSknXG4gICAgO1xuICAgIFxuICAgIHZhciBVUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkw7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogYnVmZmVyIGNvbnRyb2xsZXJcbiAqXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4gaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4gaW1wb3J0IERlbXV4ZXIgICAgICAgICAgICAgIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXInO1xuIGltcG9ydCB7RXJyb3JUeXBlcyxFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBCdWZmZXJDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLkVSUk9SID0gLTI7XG4gICAgdGhpcy5TVEFSVElORyA9IC0xO1xuICAgIHRoaXMuSURMRSA9IDA7XG4gICAgdGhpcy5MT0FESU5HID0gIDE7XG4gICAgdGhpcy5XQUlUSU5HX0xFVkVMID0gMjtcbiAgICB0aGlzLlBBUlNJTkcgPSAzO1xuICAgIHRoaXMuUEFSU0VEID0gNDtcbiAgICB0aGlzLkFQUEVORElORyA9IDU7XG4gICAgdGhpcy5CVUZGRVJfRkxVU0hJTkcgPSA2O1xuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSAwO1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIC8vIFNvdXJjZSBCdWZmZXIgbGlzdGVuZXJzXG4gICAgdGhpcy5vbnNidWUgPSB0aGlzLm9uU291cmNlQnVmZmVyVXBkYXRlRW5kLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnNiZSAgPSB0aGlzLm9uU291cmNlQnVmZmVyRXJyb3IuYmluZCh0aGlzKTtcbiAgICAvLyBpbnRlcm5hbCBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1TRUF0dGFjaGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1wID0gdGhpcy5vbk1hbmlmZXN0UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdtZW50TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmlzID0gdGhpcy5vbkluaXRTZWdtZW50LmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwZyA9IHRoaXMub25GcmFnbWVudFBhcnNpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZnAgPSB0aGlzLm9uRnJhZ21lbnRQYXJzZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZXJyID0gdGhpcy5vbkVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NU0VfQVRUQUNIRUQsIHRoaXMub25tc2UpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgfVxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHRoaXMub25tcCk7XG4gICAgLy8gcmVtb3ZlIHZpZGVvIGxpc3RlbmVyXG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVraW5nJyx0aGlzLm9udnNlZWtpbmcpO1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVrZWQnLHRoaXMub252c2Vla2VkKTtcbiAgICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLHRoaXMub252bWV0YWRhdGEpO1xuICAgICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9udm1ldGFkYXRhID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgfVxuXG4gIHN0YXJ0TG9hZCgpIHtcbiAgICBpZih0aGlzLmxldmVscyAmJiB0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnN0YXJ0SW50ZXJuYWwoKTtcbiAgICAgIGlmKHRoaXMubGFzdEN1cnJlbnRUaW1lKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYHJlc3VtaW5nIHZpZGVvIEAgJHt0aGlzLmxhc3RDdXJyZW50VGltZX1gKTtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5TVEFSVElORztcbiAgICAgIH1cbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybihgY2Fubm90IHN0YXJ0IGxvYWRpbmcgYXMgZWl0aGVyIG1hbmlmZXN0IG5vdCBwYXJzZWQgb3IgdmlkZW8gbm90IGF0dGFjaGVkYCk7XG4gICAgfVxuICB9XG5cbiAgc3RhcnRJbnRlcm5hbCgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcih0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgIHRoaXMubGV2ZWwgPSAtMTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB0aGlzLm9uZnBnKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgdGhpcy5vbmZwKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICB9XG5cblxuICBzdG9wKCkge1xuICAgIHRoaXMubXA0c2VnbWVudHMgPSBbXTtcbiAgICB0aGlzLmZsdXNoUmFuZ2UgPSBbXTtcbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gW107XG4gICAgaWYodGhpcy5mcmFnKSB7XG4gICAgICBpZih0aGlzLmZyYWcubG9hZGVyKSB7XG4gICAgICAgIHRoaXMuZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZih0aGlzLmRlbXV4ZXIpIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgdGhpcy5vbmZwZyk7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgdGhpcy5vbmlzKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRVJST1IsIHRoaXMub25lcnIpO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgcG9zLGxldmVsLGxldmVsRGV0YWlscyxmcmFnSWR4O1xuICAgIHN3aXRjaCh0aGlzLnN0YXRlKSB7XG4gICAgICBjYXNlIHRoaXMuRVJST1I6XG4gICAgICAgIC8vZG9uJ3QgZG8gYW55dGhpbmcgaW4gZXJyb3Igc3RhdGUgdG8gYXZvaWQgYnJlYWtpbmcgZnVydGhlciAuLi5cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IHRoaXMuaGxzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgLy8gLTEgOiBndWVzcyBzdGFydCBMZXZlbCBieSBkb2luZyBhIGJpdHJhdGUgdGVzdCBieSBsb2FkaW5nIGZpcnN0IGZyYWdtZW50IG9mIGxvd2VzdCBxdWFsaXR5IGxldmVsXG4gICAgICAgICAgdGhpcy5zdGFydExldmVsID0gMDtcbiAgICAgICAgICB0aGlzLmZyYWdtZW50Qml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmhscy5uZXh0TG9hZExldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5XQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSB0aGlzLklETEU6XG4gICAgICAgIC8vIGhhbmRsZSBlbmQgb2YgaW1tZWRpYXRlIHN3aXRjaGluZyBpZiBuZWVkZWRcbiAgICAgICAgaWYodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgICAgICB0aGlzLmltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZWVrIGJhY2sgdG8gYSBleHBlY3RlZCBwb3NpdGlvbiBhZnRlciB2aWRlbyBzdGFsbGluZ1xuICAgICAgICBpZih0aGlzLnNlZWtBZnRlclN0YWxsaW5nKSB7XG4gICAgICAgICAgdGhpcy52aWRlby5jdXJyZW50VGltZT10aGlzLnNlZWtBZnRlclN0YWxsaW5nO1xuICAgICAgICAgIHRoaXMuc2Vla0FmdGVyU3RhbGxpbmcgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBjYW5kaWRhdGUgZnJhZ21lbnQgdG8gYmUgbG9hZGVkLCBiYXNlZCBvbiBjdXJyZW50IHBvc2l0aW9uIGFuZFxuICAgICAgICAvLyAgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAvLyAgZW5zdXJlIDYwcyBvZiBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiB3ZSBoYXZlIG5vdCB5ZXQgbG9hZGVkIGFueSBmcmFnbWVudCwgc3RhcnQgbG9hZGluZyBmcm9tIHN0YXJ0IHBvc2l0aW9uXG4gICAgICAgIGlmKHRoaXMubG9hZGVkbWV0YWRhdGEpIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBvcyA9IHRoaXMubmV4dExvYWRQb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBsb2FkIGxldmVsXG4gICAgICAgIGlmKHRoaXMuc3RhcnRGcmFnbWVudFJlcXVlc3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBsZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB3ZSBhcmUgbm90IGF0IHBsYXliYWNrIHN0YXJ0LCBnZXQgbmV4dCBsb2FkIGxldmVsIGZyb20gbGV2ZWwgQ29udHJvbGxlclxuICAgICAgICAgIGxldmVsID0gdGhpcy5obHMubmV4dExvYWRMZXZlbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IHRoaXMuYnVmZmVySW5mbyhwb3MpLCBidWZmZXJMZW4gPSBidWZmZXJJbmZvLmxlbiwgYnVmZmVyRW5kID0gYnVmZmVySW5mby5lbmQsIG1heEJ1ZkxlbjtcbiAgICAgICAgLy8gY29tcHV0ZSBtYXggQnVmZmVyIExlbmd0aCB0aGF0IHdlIGNvdWxkIGdldCBmcm9tIHRoaXMgbG9hZCBsZXZlbCwgYmFzZWQgb24gbGV2ZWwgYml0cmF0ZS4gZG9uJ3QgYnVmZmVyIG1vcmUgdGhhbiA2MCBNQiBhbmQgbW9yZSB0aGFuIDMwc1xuICAgICAgICBpZigodGhpcy5sZXZlbHNbbGV2ZWxdKS5oYXNPd25Qcm9wZXJ0eSgnYml0cmF0ZScpKSB7XG4gICAgICAgICAgbWF4QnVmTGVuID0gTWF0aC5tYXgoOCp0aGlzLmNvbmZpZy5tYXhCdWZmZXJTaXplL3RoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlLHRoaXMuY29uZmlnLm1heEJ1ZmZlckxlbmd0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWF4QnVmTGVuID0gdGhpcy5jb25maWcubWF4QnVmZmVyTGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIGJ1ZmZlciBsZW5ndGggaXMgbGVzcyB0aGFuIG1heEJ1ZkxlbiB0cnkgdG8gbG9hZCBhIG5ldyBmcmFnbWVudFxuICAgICAgICBpZihidWZmZXJMZW4gPCBtYXhCdWZMZW4pIHtcbiAgICAgICAgICAvLyBzZXQgbmV4dCBsb2FkIGxldmVsIDogdGhpcyB3aWxsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkIGlmIG5lZWRlZFxuICAgICAgICAgIHRoaXMuaGxzLm5leHRMb2FkTGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgICAgbGV2ZWxEZXRhaWxzID0gdGhpcy5sZXZlbHNbbGV2ZWxdLmRldGFpbHM7XG4gICAgICAgICAgLy8gaWYgbGV2ZWwgaW5mbyBub3QgcmV0cmlldmVkIHlldCwgc3dpdGNoIHN0YXRlIGFuZCB3YWl0IGZvciBsZXZlbCByZXRyaWV2YWxcbiAgICAgICAgICBpZih0eXBlb2YgbGV2ZWxEZXRhaWxzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuV0FJVElOR19MRVZFTDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBmaW5kIGZyYWdtZW50IGluZGV4LCBjb250aWd1b3VzIHdpdGggZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAgIGxldCBmcmFnbWVudHMgPSBsZXZlbERldGFpbHMuZnJhZ21lbnRzLCBmcmFnLCBzbGlkaW5nID0gbGV2ZWxEZXRhaWxzLnNsaWRpbmcsIHN0YXJ0ID0gZnJhZ21lbnRzWzBdLnN0YXJ0ICsgc2xpZGluZywgZHJpZnQgPTA7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAvLyBpbiBjYXNlIG9mIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byBlbnN1cmUgdGhhdCByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgbm90IGxvY2F0ZWQgYmVmb3JlIHBsYXlsaXN0IHN0YXJ0XG4gICAgICAgICAgLy9sb2dnZXIubG9nKGBzdGFydC9wb3MvYnVmRW5kL3NlZWtpbmc6JHtzdGFydC50b0ZpeGVkKDMpfS8ke3Bvcy50b0ZpeGVkKDMpfS8ke2J1ZmZlckVuZC50b0ZpeGVkKDMpfS8ke3RoaXMudmlkZW8uc2Vla2luZ31gKTtcbiAgICAgICAgICBpZihidWZmZXJFbmQgPCBzdGFydCkge1xuICAgICAgICAgICAgICB0aGlzLnNlZWtBZnRlclN0YWxsaW5nID0gdGhpcy5zdGFydFBvc2l0aW9uICsgc2xpZGluZztcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYnVmZmVyIGVuZDogJHtidWZmZXJFbmR9IGlzIGxvY2F0ZWQgYmVmb3JlIHN0YXJ0IG9mIGxpdmUgc2xpZGluZyBwbGF5bGlzdCwgbWVkaWEgcG9zaXRpb24gd2lsbCBiZSByZXNldGVkIHRvOiAke3RoaXMuc2Vla0FmdGVyU3RhbGxpbmcudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgYnVmZmVyRW5kID0gdGhpcy5zZWVrQWZ0ZXJTdGFsbGluZztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZihsZXZlbERldGFpbHMubGl2ZSAmJiBsZXZlbERldGFpbHMuc2xpZGluZyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvKiB3ZSBhcmUgc3dpdGNoaW5nIGxldmVsIG9uIGxpdmUgcGxheWxpc3QsIGJ1dCB3ZSBkb24ndCBoYXZlIGFueSBzbGlkaW5nIGluZm8gLi4uXG4gICAgICAgICAgICAgICB0cnkgdG8gbG9hZCBmcmFnIG1hdGNoaW5nIHdpdGggbmV4dCBTTi5cbiAgICAgICAgICAgICAgIGV2ZW4gaWYgU04gYXJlIG5vdCBzeW5jaHJvbml6ZWQgYmV0d2VlbiBwbGF5bGlzdHMsIGxvYWRpbmcgdGhpcyBmcmFnIHdpbGwgaGVscCB1c1xuICAgICAgICAgICAgICAgY29tcHV0ZSBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmUgYWZ0ZXIgaW4gY2FzZSBpdCB3YXMgbm90IHRoZSByaWdodCBjb25zZWN1dGl2ZSBvbmUgKi9cbiAgICAgICAgICAgIGlmKHRoaXMuZnJhZykge1xuICAgICAgICAgICAgICB2YXIgdGFyZ2V0U04gPSB0aGlzLmZyYWcuc24rMTtcbiAgICAgICAgICAgICAgaWYodGFyZ2V0U04gPj0gbGV2ZWxEZXRhaWxzLnN0YXJ0U04gJiYgdGFyZ2V0U04gPD0gbGV2ZWxEZXRhaWxzLmVuZFNOKSB7XG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1t0YXJnZXRTTi1sZXZlbERldGFpbHMuc3RhcnRTTl07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCBsb2FkIGZyYWcgd2l0aCBuZXh0IFNOOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKCFmcmFnKSB7XG4gICAgICAgICAgICAgIC8qIHdlIGhhdmUgbm8gaWRlYSBhYm91dCB3aGljaCBmcmFnbWVudCBzaG91bGQgYmUgbG9hZGVkLlxuICAgICAgICAgICAgICAgICBzbyBsZXQncyBsb2FkIG1pZCBmcmFnbWVudC4gaXQgd2lsbCBoZWxwIGNvbXB1dGluZyBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmVcbiAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tNYXRoLnJvdW5kKGZyYWdtZW50cy5sZW5ndGgvMildO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIHVua25vd24sIGxvYWQgbWlkZGxlIGZyYWcgOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2xvb2sgZm9yIGZyYWdtZW50cyBtYXRjaGluZyB3aXRoIGN1cnJlbnQgcGxheSBwb3NpdGlvblxuICAgICAgICAgICAgZm9yIChmcmFnSWR4ID0gMDsgZnJhZ0lkeCA8IGZyYWdtZW50cy5sZW5ndGggOyBmcmFnSWR4KyspIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcbiAgICAgICAgICAgICAgc3RhcnQgPSBmcmFnLnN0YXJ0K3NsaWRpbmc7XG4gICAgICAgICAgICAgIGlmKGZyYWcuZHJpZnQpIHtcbiAgICAgICAgICAgICAgICBkcmlmdCA9IGZyYWcuZHJpZnQ7XG4gICAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBsZXZlbC9zbi9zbGlkaW5nL3N0YXJ0L2VuZC9idWZFbmQ6JHtsZXZlbH0vJHtmcmFnLnNufS8ke3NsaWRpbmd9LyR7c3RhcnQudG9GaXhlZCgzKX0vJHsoc3RhcnQrZnJhZy5kdXJhdGlvbikudG9GaXhlZCgzKX0vJHtidWZmZXJFbmQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBzdGFydCs9ZHJpZnQ7XG4gICAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5XG4gICAgICAgICAgICAgIGlmKHN0YXJ0IDw9IGJ1ZmZlckVuZCAmJiAoc3RhcnQgKyBmcmFnLmR1cmF0aW9uKSA+IGJ1ZmZlckVuZCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihmcmFnSWR4ID09PSBmcmFnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIC8vIHJlYWNoIGVuZCBvZiBwbGF5bGlzdFxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgaWYodGhpcy5mcmFnICYmIGZyYWcuc24gPT09IHRoaXMuZnJhZy5zbikge1xuICAgICAgICAgICAgICBpZihmcmFnSWR4ID09PSAoZnJhZ21lbnRzLmxlbmd0aCAtMSkpIHtcbiAgICAgICAgICAgICAgICAvLyB3ZSBhcmUgYXQgdGhlIGVuZCBvZiB0aGUgcGxheWxpc3QgYW5kIHdlIGFscmVhZHkgbG9hZGVkIGxhc3QgZnJhZ21lbnQsIGRvbid0IGRvIGFueXRoaW5nXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4KzFdO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyAgICAgICAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfSwgYnVmZmVyRW5kOiR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9YCk7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCcgICAgICBsb2FkaW5nIGZyYWcgJyArIGkgKycscG9zL2J1ZkVuZDonICsgcG9zLnRvRml4ZWQoMykgKyAnLycgKyBidWZmZXJFbmQudG9GaXhlZCgzKSk7XG4gICAgICAgICAgZnJhZy5kcmlmdCA9IGRyaWZ0O1xuICAgICAgICAgIGZyYWcuYXV0b0xldmVsID0gdGhpcy5obHMuYXV0b0xldmVsRW5hYmxlZDtcbiAgICAgICAgICBpZih0aGlzLmxldmVscy5sZW5ndGg+MSkge1xuICAgICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IE1hdGgucm91bmQoZnJhZy5kdXJhdGlvbip0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZS84KTtcbiAgICAgICAgICAgIGZyYWcudHJlcXVlc3QgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIGVuc3VyZSB0aGF0IHdlIGFyZSBub3QgcmVsb2FkaW5nIHRoZSBzYW1lIGZyYWdtZW50cyBpbiBsb29wIC4uLlxuICAgICAgICAgIGlmKHRoaXMuZnJhZ0xvYWRJZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCsrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4ID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZnJhZy5sb2FkQ291bnRlcikge1xuICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlcisrO1xuICAgICAgICAgICAgbGV0IG1heFRocmVzaG9sZCA9IHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAgICAgICAgIC8vIGlmIHRoaXMgZnJhZyBoYXMgYWxyZWFkeSBiZWVuIGxvYWRlZCAzIHRpbWVzLCBhbmQgaWYgaXQgaGFzIGJlZW4gcmVsb2FkZWQgcmVjZW50bHlcbiAgICAgICAgICAgIGlmKGZyYWcubG9hZENvdW50ZXIgPiBtYXhUaHJlc2hvbGQgJiYgKE1hdGguYWJzKHRoaXMuZnJhZ0xvYWRJZHggLSBmcmFnLmxvYWRJZHgpIDwgbWF4VGhyZXNob2xkKSkge1xuICAgICAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1IsIGZhdGFsOmZhbHNlLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlcj0xO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmcmFnLmxvYWRJZHggPSB0aGlzLmZyYWdMb2FkSWR4O1xuICAgICAgICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgICAgICAgdGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRElORywgeyBmcmFnOiBmcmFnIH0pO1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLkxPQURJTkc7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuV0FJVElOR19MRVZFTDpcbiAgICAgICAgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAgICAgLy8gY2hlY2sgaWYgcGxheWxpc3QgaXMgYWxyZWFkeSBsb2FkZWRcbiAgICAgICAgaWYobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuTE9BRElORzpcbiAgICAgICAgLypcbiAgICAgICAgICBtb25pdG9yIGZyYWdtZW50IHJldHJpZXZhbCB0aW1lLi4uXG4gICAgICAgICAgd2UgY29tcHV0ZSBleHBlY3RlZCB0aW1lIG9mIGFycml2YWwgb2YgdGhlIGNvbXBsZXRlIGZyYWdtZW50LlxuICAgICAgICAgIHdlIGNvbXBhcmUgaXQgdG8gZXhwZWN0ZWQgdGltZSBvZiBidWZmZXIgc3RhcnZhdGlvblxuICAgICAgICAqL1xuICAgICAgICBsZXQgdiA9IHRoaXMudmlkZW8sZnJhZyA9IHRoaXMuZnJhZztcbiAgICAgICAgLyogb25seSBtb25pdG9yIGZyYWcgcmV0cmlldmFsIHRpbWUgaWZcbiAgICAgICAgKHZpZGVvIG5vdCBwYXVzZWQgT1IgZmlyc3QgZnJhZ21lbnQgYmVpbmcgbG9hZGVkKSBBTkQgYXV0b3N3aXRjaGluZyBlbmFibGVkIEFORCBub3QgbG93ZXN0IGxldmVsIEFORCBtdWx0aXBsZSBsZXZlbHMgKi9cbiAgICAgICAgaWYodiAmJiAoIXYucGF1c2VkIHx8IHRoaXMubG9hZGVkbWV0YWRhdGEgPT09IGZhbHNlKSAmJiBmcmFnLmF1dG9MZXZlbCAmJiB0aGlzLmxldmVsICYmIHRoaXMubGV2ZWxzLmxlbmd0aD4xICkge1xuICAgICAgICAgIHZhciByZXF1ZXN0RGVsYXk9bmV3IERhdGUoKS1mcmFnLnRyZXF1ZXN0O1xuICAgICAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICAgICAgaWYocmVxdWVzdERlbGF5ID4gNTAwKmZyYWcuZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHZhciBsb2FkUmF0ZSA9IGZyYWcubG9hZGVkKjEwMDAvcmVxdWVzdERlbGF5OyAvLyBieXRlL3NcbiAgICAgICAgICAgIGlmKGZyYWcuZXhwZWN0ZWRMZW4gPCBmcmFnLmxvYWRlZCkge1xuICAgICAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gZnJhZy5sb2FkZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwb3MgPSB2LmN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgdmFyIGZyYWdMb2FkZWREZWxheSA9KGZyYWcuZXhwZWN0ZWRMZW4tZnJhZy5sb2FkZWQpL2xvYWRSYXRlO1xuICAgICAgICAgICAgdmFyIGJ1ZmZlclN0YXJ2YXRpb25EZWxheT10aGlzLmJ1ZmZlckluZm8ocG9zKS5lbmQtcG9zO1xuICAgICAgICAgICAgdmFyIGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA9IGZyYWcuZHVyYXRpb24qdGhpcy5sZXZlbHNbdGhpcy5obHMubmV4dExvYWRMZXZlbF0uYml0cmF0ZS8oOCpsb2FkUmF0ZSk7IC8vYnBzL0Jwc1xuICAgICAgICAgICAgLyogaWYgd2UgaGF2ZSBsZXNzIHRoYW4gMiBmcmFnIGR1cmF0aW9uIGluIGJ1ZmZlciBhbmQgaWYgZnJhZyBsb2FkZWQgZGVsYXkgaXMgZ3JlYXRlciB0aGFuIGJ1ZmZlciBzdGFydmF0aW9uIGRlbGF5XG4gICAgICAgICAgICAgIC4uLiBhbmQgYWxzbyBiaWdnZXIgdGhhbiBkdXJhdGlvbiBuZWVkZWQgdG8gbG9hZCBmcmFnbWVudCBhdCBuZXh0IGxldmVsIC4uLiovXG4gICAgICAgICAgICBpZihidWZmZXJTdGFydmF0aW9uRGVsYXkgPCAyKmZyYWcuZHVyYXRpb24gJiYgZnJhZ0xvYWRlZERlbGF5ID4gYnVmZmVyU3RhcnZhdGlvbkRlbGF5ICYmIGZyYWdMb2FkZWREZWxheSA+IGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIC4uLlxuICAgICAgICAgICAgICBsb2dnZXIud2FybignbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZycpO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmcmFnTG9hZGVkRGVsYXkvYnVmZmVyU3RhcnZhdGlvbkRlbGF5L2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA6JHtmcmFnTG9hZGVkRGVsYXkudG9GaXhlZCgxKX0vJHtidWZmZXJTdGFydmF0aW9uRGVsYXkudG9GaXhlZCgxKX0vJHtmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkudG9GaXhlZCgxKX1gKTtcbiAgICAgICAgICAgICAgLy9hYm9ydCBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB7IGZyYWc6IGZyYWcgfSk7XG4gICAgICAgICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgdG8gcmVxdWVzdCBuZXcgZnJhZ21lbnQgYXQgbG93ZXN0IGxldmVsXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSB0aGlzLlBBUlNJTkc6XG4gICAgICAgIC8vIG5vdGhpbmcgdG8gZG8sIHdhaXQgZm9yIGZyYWdtZW50IGJlaW5nIHBhcnNlZFxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5QQVJTRUQ6XG4gICAgICBjYXNlIHRoaXMuQVBQRU5ESU5HOlxuICAgICAgICBpZiAodGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgICAvLyBpZiBNUDQgc2VnbWVudCBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3Mgbm90aGluZyB0byBkb1xuICAgICAgICAgIGlmKCh0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpby51cGRhdGluZykgfHxcbiAgICAgICAgICAgICAodGhpcy5zb3VyY2VCdWZmZXIudmlkZW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIudmlkZW8udXBkYXRpbmcpKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3NiIGFwcGVuZCBpbiBwcm9ncmVzcycpO1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgTVA0IHNlZ21lbnRzIGxlZnQgdG8gYXBwZW5kXG4gICAgICAgICAgfSBlbHNlIGlmKHRoaXMubXA0c2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VnbWVudCA9IHRoaXMubXA0c2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9YCk7XG4gICAgICAgICAgICAgIHRoaXMuc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0uYXBwZW5kQnVmZmVyKHNlZ21lbnQuZGF0YSk7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3I9MDtcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgIC8vIGluIGNhc2UgYW55IGVycm9yIG9jY3VyZWQgd2hpbGUgYXBwZW5kaW5nLCBwdXQgYmFjayBzZWdtZW50IGluIG1wNHNlZ21lbnRzIHRhYmxlXG4gICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgZXJyb3Igd2hpbGUgdHJ5aW5nIHRvIGFwcGVuZCBidWZmZXI6JHtlcnIubWVzc2FnZX0sdHJ5IGFwcGVuZGluZyBsYXRlcmApO1xuICAgICAgICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnVuc2hpZnQoc2VnbWVudCk7XG4gICAgICAgICAgICAgIGlmKHRoaXMuYXBwZW5kRXJyb3IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvcj0xO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhciBldmVudCA9IHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0FQUEVORElOR19FUlJPUiwgZnJhZyA6IHRoaXMuZnJhZ307XG4gICAgICAgICAgICAgIC8qIHdpdGggVUhEIGNvbnRlbnQsIHdlIGNvdWxkIGdldCBsb29wIG9mIHF1b3RhIGV4Y2VlZGVkIGVycm9yIHVudGlsXG4gICAgICAgICAgICAgICAgYnJvd3NlciBpcyBhYmxlIHRvIGV2aWN0IHNvbWUgZGF0YSBmcm9tIHNvdXJjZWJ1ZmZlci4gcmV0cnlpbmcgaGVscCByZWNvdmVyaW5nIHRoaXNcbiAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgaWYodGhpcy5hcHBlbmRFcnJvciA+IHRoaXMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnkpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmYWlsICR7dGhpcy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeX0gdGltZXMgdG8gYXBwZW5kIHNlZ21lbnQgaW4gc291cmNlQnVmZmVyYCk7XG4gICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5FUlJPUjtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLkFQUEVORElORztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuQlVGRkVSX0ZMVVNISU5HOlxuICAgICAgICAvLyBsb29wIHRocm91Z2ggYWxsIGJ1ZmZlciByYW5nZXMgdG8gZmx1c2hcbiAgICAgICAgd2hpbGUodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCkge1xuICAgICAgICAgIHZhciByYW5nZSA9IHRoaXMuZmx1c2hSYW5nZVswXTtcbiAgICAgICAgICAvLyBmbHVzaEJ1ZmZlciB3aWxsIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzIGFuZCBmbHVzaCBBdWRpby9WaWRlbyBCdWZmZXJcbiAgICAgICAgICBpZih0aGlzLmZsdXNoQnVmZmVyKHJhbmdlLnN0YXJ0LHJhbmdlLmVuZCkpIHtcbiAgICAgICAgICAgIC8vIHJhbmdlIGZsdXNoZWQsIHJlbW92ZSBmcm9tIGZsdXNoIGFycmF5XG4gICAgICAgICAgICB0aGlzLmZsdXNoUmFuZ2Uuc2hpZnQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmx1c2ggaW4gcHJvZ3Jlc3MsIGNvbWUgYmFjayBsYXRlclxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIC8vIG1vdmUgdG8gSURMRSBvbmNlIGZsdXNoIGNvbXBsZXRlLiB0aGlzIHNob3VsZCB0cmlnZ2VyIG5ldyBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgICAgICAgICAvLyByZXNldCByZWZlcmVuY2UgdG8gZnJhZ1xuICAgICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgIC8qIGlmIG5vdCBldmVyeXRoaW5nIGZsdXNoZWQsIHN0YXkgaW4gQlVGRkVSX0ZMVVNISU5HIHN0YXRlLiB3ZSB3aWxsIGNvbWUgYmFjayBoZXJlXG4gICAgICAgICAgICBlYWNoIHRpbWUgc291cmNlQnVmZmVyIHVwZGF0ZWVuZCgpIGNhbGxiYWNrIHdpbGwgYmUgdHJpZ2dlcmVkXG4gICAgICAgICAgICAqL1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBjaGVjay91cGRhdGUgY3VycmVudCBmcmFnbWVudFxuICAgIHRoaXMuX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCk7XG4gIH1cblxuICAgYnVmZmVySW5mbyhwb3MpIHtcbiAgICB2YXIgdiA9IHRoaXMudmlkZW8sXG4gICAgICAgIGJ1ZmZlcmVkID0gdi5idWZmZXJlZCxcbiAgICAgICAgYnVmZmVyTGVuLFxuICAgICAgICAvLyBidWZmZXJTdGFydCBhbmQgYnVmZmVyRW5kIGFyZSBidWZmZXIgYm91bmRhcmllcyBhcm91bmQgY3VycmVudCB2aWRlbyBwb3NpdGlvblxuICAgICAgICBidWZmZXJTdGFydCxidWZmZXJFbmQsXG4gICAgICAgIGk7XG4gICAgdmFyIGJ1ZmZlcmVkMiA9IFtdO1xuICAgIC8vIHRoZXJlIG1pZ2h0IGJlIHNvbWUgc21hbGwgaG9sZXMgYmV0d2VlbiBidWZmZXIgdGltZSByYW5nZVxuICAgIC8vIGNvbnNpZGVyIHRoYXQgaG9sZXMgc21hbGxlciB0aGFuIDMwMCBtcyBhcmUgaXJyZWxldmFudCBhbmQgYnVpbGQgYW5vdGhlclxuICAgIC8vIGJ1ZmZlciB0aW1lIHJhbmdlIHJlcHJlc2VudGF0aW9ucyB0aGF0IGRpc2NhcmRzIHRob3NlIGhvbGVzXG4gICAgZm9yKGkgPSAwIDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aCA7IGkrKykge1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZigoYnVmZmVyZWQyLmxlbmd0aCkgJiYgKGJ1ZmZlcmVkLnN0YXJ0KGkpIC0gYnVmZmVyZWQyW2J1ZmZlcmVkMi5sZW5ndGgtMV0uZW5kICkgPCAwLjMpIHtcbiAgICAgICAgYnVmZmVyZWQyW2J1ZmZlcmVkMi5sZW5ndGgtMV0uZW5kID0gYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVmZmVyZWQyLnB1c2goe3N0YXJ0IDogYnVmZmVyZWQuc3RhcnQoaSksZW5kIDogYnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvcyA7IGkgPCBidWZmZXJlZDIubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmKChwb3MrMC4zKSA+PSBidWZmZXJlZDJbaV0uc3RhcnQgJiYgcG9zIDwgYnVmZmVyZWQyW2ldLmVuZCkge1xuICAgICAgICAvLyBwbGF5IHBvc2l0aW9uIGlzIGluc2lkZSB0aGlzIGJ1ZmZlciBUaW1lUmFuZ2UsIHJldHJpZXZlIGVuZCBvZiBidWZmZXIgcG9zaXRpb24gYW5kIGJ1ZmZlciBsZW5ndGhcbiAgICAgICAgYnVmZmVyU3RhcnQgPSBidWZmZXJlZDJbaV0uc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQgKyAwLjM7XG4gICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtsZW4gOiBidWZmZXJMZW4sIHN0YXJ0IDogYnVmZmVyU3RhcnQsIGVuZCA6IGJ1ZmZlckVuZH07XG4gIH1cblxuXG4gIGdldEJ1ZmZlclJhbmdlKHBvc2l0aW9uKSB7XG4gICAgdmFyIGkscmFuZ2U7XG4gICAgZm9yIChpID0gdGhpcy5idWZmZXJSYW5nZS5sZW5ndGgtMTsgaSA+PTAgOyBpLS0pIHtcbiAgICAgIHJhbmdlID0gdGhpcy5idWZmZXJSYW5nZVtpXTtcbiAgICAgIGlmKHBvc2l0aW9uID49IHJhbmdlLnN0YXJ0ICYmIHBvc2l0aW9uIDw9IHJhbmdlLmVuZCkge1xuICAgICAgICByZXR1cm4gcmFuZ2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cblxuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSk7XG4gICAgICBpZihyYW5nZSkge1xuICAgICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgZ2V0IG5leHRCdWZmZXJSYW5nZSgpIHtcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICAvLyBmaXJzdCBnZXQgZW5kIHJhbmdlIG9mIGN1cnJlbnQgZnJhZ21lbnRcbiAgICAgIHJldHVybiB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmb2xsb3dpbmdCdWZmZXJSYW5nZShyYW5nZSkge1xuICAgIGlmKHJhbmdlKSB7XG4gICAgICAvLyB0cnkgdG8gZ2V0IHJhbmdlIG9mIG5leHQgZnJhZ21lbnQgKDUwMG1zIGFmdGVyIHRoaXMgcmFuZ2UpXG4gICAgICByZXR1cm4gdGhpcy5nZXRCdWZmZXJSYW5nZShyYW5nZS5lbmQrMC41KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgdmFyIHJhbmdlID0gdGhpcy5uZXh0QnVmZmVyUmFuZ2U7XG4gICAgaWYocmFuZ2UpIHtcbiAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuICB9XG5cbiAgaXNCdWZmZXJlZChwb3NpdGlvbikge1xuICAgIHZhciB2ID0gdGhpcy52aWRlbyxidWZmZXJlZCA9IHYuYnVmZmVyZWQ7XG4gICAgZm9yKHZhciBpID0gMCA7IGkgPCBidWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgIGlmKHBvc2l0aW9uID49IGJ1ZmZlcmVkLnN0YXJ0KGkpICYmIHBvc2l0aW9uIDw9IGJ1ZmZlcmVkLmVuZChpKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCkge1xuICAgIHZhciByYW5nZUN1cnJlbnQsIGN1cnJlbnRUaW1lO1xuICAgIGlmKHRoaXMudmlkZW8gJiYgdGhpcy52aWRlby5zZWVraW5nID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSBjdXJyZW50VGltZSA9IHRoaXMudmlkZW8uY3VycmVudFRpbWU7XG4gICAgICBpZih0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUpKSB7XG4gICAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UoY3VycmVudFRpbWUpO1xuICAgICAgfSBlbHNlIGlmKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSswLjEpKSB7XG4gICAgICAgIC8qIGVuc3VyZSB0aGF0IEZSQUdfQ0hBTkdFRCBldmVudCBpcyB0cmlnZ2VyZWQgYXQgc3RhcnR1cCxcbiAgICAgICAgICB3aGVuIGZpcnN0IHZpZGVvIGZyYW1lIGlzIGRpc3BsYXllZCBhbmQgcGxheWJhY2sgaXMgcGF1c2VkLlxuICAgICAgICAgIGFkZCBhIHRvbGVyYW5jZSBvZiAxMDBtcywgaW4gY2FzZSBjdXJyZW50IHBvc2l0aW9uIGlzIG5vdCBidWZmZXJlZCxcbiAgICAgICAgICBjaGVjayBpZiBjdXJyZW50IHBvcysxMDBtcyBpcyBidWZmZXJlZCBhbmQgdXNlIHRoYXQgYnVmZmVyIHJhbmdlXG4gICAgICAgICAgZm9yIEZSQUdfQ0hBTkdFRCBldmVudCByZXBvcnRpbmcgKi9cbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSswLjEpO1xuICAgICAgfVxuICAgICAgaWYocmFuZ2VDdXJyZW50KSB7XG4gICAgICAgIGlmKHJhbmdlQ3VycmVudC5mcmFnICE9PSB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IHJhbmdlQ3VycmVudC5mcmFnO1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19DSEFOR0VELCB7IGZyYWcgOiB0aGlzLmZyYWdDdXJyZW50IH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIHN0cmVhbSBpcyBWT0QgKG5vdCBsaXZlKSBhbmQgd2UgcmVhY2ggRW5kIG9mIFN0cmVhbVxuICAgICAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAgICAgaWYobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscyAmJiAhbGV2ZWwuZGV0YWlscy5saXZlICYmICh0aGlzLnZpZGVvLmR1cmF0aW9uIC0gY3VycmVudFRpbWUpIDwgMC4yKSB7XG4gICAgICAgICAgaWYodGhpcy5tZWRpYVNvdXJjZSAmJiB0aGlzLm1lZGlhU291cmNlLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZW5kIG9mIFZvRCBzdHJlYW0gcmVhY2hlZCwgc2lnbmFsIGVuZE9mU3RyZWFtKCkgdG8gTWVkaWFTb3VyY2VgKTtcbiAgICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuLypcbiAgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MsIGFuZCBmbHVzaCBhbGwgYnVmZmVyZWQgZGF0YVxuICByZXR1cm4gdHJ1ZSBvbmNlIGV2ZXJ5dGhpbmcgaGFzIGJlZW4gZmx1c2hlZC5cbiAgc291cmNlQnVmZmVyLmFib3J0KCkgYW5kIHNvdXJjZUJ1ZmZlci5yZW1vdmUoKSBhcmUgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnNcbiAgdGhlIGlkZWEgaXMgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIGZyb20gdGljaygpIHRpbWVyIGFuZCBjYWxsIGl0IGFnYWluIHVudGlsIGFsbCByZXNvdXJjZXMgaGF2ZSBiZWVuIGNsZWFuZWRcbiAgdGhlIHRpbWVyIGlzIHJlYXJtZWQgdXBvbiBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgZXZlbnQsIHNvIHRoaXMgc2hvdWxkIGJlIG9wdGltYWxcbiovXG4gIGZsdXNoQnVmZmVyKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpIHtcbiAgICB2YXIgc2IsaSxidWZTdGFydCxidWZFbmQsIGZsdXNoU3RhcnQsIGZsdXNoRW5kO1xuICAgIC8vbG9nZ2VyLmxvZygnZmx1c2hCdWZmZXIscG9zL3N0YXJ0L2VuZDogJyArIHRoaXMudmlkZW8uY3VycmVudFRpbWUgKyAnLycgKyBzdGFydE9mZnNldCArICcvJyArIGVuZE9mZnNldCk7XG4gICAgLy8gc2FmZWd1YXJkIHRvIGF2b2lkIGluZmluaXRlIGxvb3BpbmdcbiAgICBpZih0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrIDwgMip0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIGlmKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvcihpID0gMCA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgICAgIGJ1ZlN0YXJ0ID0gc2IuYnVmZmVyZWQuc3RhcnQoaSk7XG4gICAgICAgICAgICBidWZFbmQgPSBzYi5idWZmZXJlZC5lbmQoaSk7XG4gICAgICAgICAgICAvLyB3b3JrYXJvdW5kIGZpcmVmb3ggbm90IGFibGUgdG8gcHJvcGVybHkgZmx1c2ggbXVsdGlwbGUgYnVmZmVyZWQgcmFuZ2UuXG4gICAgICAgICAgICBpZihuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiAgZW5kT2Zmc2V0ID09PSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IHN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgICBmbHVzaEVuZCA9IGVuZE9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBNYXRoLm1heChidWZTdGFydCxzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBzb21ldGltZXMgc291cmNlYnVmZmVyLnJlbW92ZSgpIGRvZXMgbm90IGZsdXNoXG4gICAgICAgICAgICAgICB0aGUgZXhhY3QgZXhwZWN0ZWQgdGltZSByYW5nZS5cbiAgICAgICAgICAgICAgIHRvIGF2b2lkIHJvdW5kaW5nIGlzc3Vlcy9pbmZpbml0ZSBsb29wLFxuICAgICAgICAgICAgICAgb25seSBmbHVzaCBidWZmZXIgcmFuZ2Ugb2YgbGVuZ3RoIGdyZWF0ZXIgdGhhbiA1MDBtcy5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZihmbHVzaEVuZCAtIGZsdXNoU3RhcnQgPiAwLjUpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmx1c2ggJHt0eXBlfSBbJHtmbHVzaFN0YXJ0fSwke2ZsdXNoRW5kfV0sIG9mIFske2J1ZlN0YXJ0fSwke2J1ZkVuZH1dLCBwb3M6JHt0aGlzLnZpZGVvLmN1cnJlbnRUaW1lfWApO1xuICAgICAgICAgICAgICBzYi5yZW1vdmUoZmx1c2hTdGFydCxmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZTtcbiAgICBmb3IgKGkgPSAwIDsgaSA8IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoIDsgaSsrKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZih0aGlzLmlzQnVmZmVyZWQoKHJhbmdlLnN0YXJ0ICsgcmFuZ2UuZW5kKS8yKSkge1xuICAgICAgICBuZXdSYW5nZS5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IG5ld1JhbmdlO1xuXG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGZsdXNoZWQnKTtcbiAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWQgIVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgICAvKlxuICAgICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCA6XG4gICAgICAgLSBwYXVzZSBwbGF5YmFjayBpZiBwbGF5aW5nXG4gICAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgICAgLSBhbmQgdHJpZ2dlciBhIGJ1ZmZlciBmbHVzaFxuICAgICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoKCkge1xuICAgIGxvZ2dlci5sb2coJ2ltbWVkaWF0ZUxldmVsU3dpdGNoJyk7XG4gICAgaWYoIXRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzbHlQYXVzZWQgPSB0aGlzLnZpZGVvLnBhdXNlZDtcbiAgICAgIHRoaXMudmlkZW8ucGF1c2UoKTtcbiAgICB9XG4gICAgaWYodGhpcy5mcmFnICYmIHRoaXMuZnJhZy5sb2FkZXIpIHtcbiAgICAgIHRoaXMuZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5mcmFnPW51bGw7XG4gICAgLy8gZmx1c2ggZXZlcnl0aGluZ1xuICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7IHN0YXJ0IDogMCwgZW5kIDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgLy8gdHJpZ2dlciBhIHNvdXJjZUJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuc3RhdGUgPSB0aGlzLkJVRkZFUl9GTFVTSElORztcbiAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuZnJhZ0xvYWRJZHgrPTIqdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbi8qXG4gICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIGVuZCwgYWZ0ZXIgbmV3IGZyYWdtZW50IGhhcyBiZWVuIGJ1ZmZlcmVkIDpcbiAgICAtIG51ZGdlIHZpZGVvIGRlY29kZXIgYnkgc2xpZ2h0bHkgYWRqdXN0aW5nIHZpZGVvIGN1cnJlbnRUaW1lXG4gICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKSB7XG4gICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSBmYWxzZTtcbiAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lLT0wLjAwMDE7XG4gICAgaWYoIXRoaXMucHJldmlvdXNseVBhdXNlZCkge1xuICAgICAgdGhpcy52aWRlby5wbGF5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExldmVsU3dpdGNoKCkge1xuICAgIC8qIHRyeSB0byBzd2l0Y2ggQVNBUCB3aXRob3V0IGJyZWFraW5nIHZpZGVvIHBsYXliYWNrIDpcbiAgICAgICBpbiBvcmRlciB0byBlbnN1cmUgc21vb3RoIGJ1dCBxdWljayBsZXZlbCBzd2l0Y2hpbmcsXG4gICAgICB3ZSBuZWVkIHRvIGZpbmQgdGhlIG5leHQgZmx1c2hhYmxlIGJ1ZmZlciByYW5nZVxuICAgICAgd2Ugc2hvdWxkIHRha2UgaW50byBhY2NvdW50IG5ldyBzZWdtZW50IGZldGNoIHRpbWVcbiAgICAqL1xuICAgIHZhciBmZXRjaGRlbGF5LGN1cnJlbnRSYW5nZSxuZXh0UmFuZ2U7XG5cbiAgICBjdXJyZW50UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUpO1xuICAgIGlmKGN1cnJlbnRSYW5nZSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7IHN0YXJ0IDogMCwgZW5kIDogY3VycmVudFJhbmdlLnN0YXJ0LTF9KTtcbiAgICB9XG5cbiAgICBpZighdGhpcy52aWRlby5wYXVzZWQpIHtcbiAgICAgIC8vIGFkZCBhIHNhZmV0eSBkZWxheSBvZiAxc1xuICAgICAgdmFyIG5leHRMZXZlbElkID0gdGhpcy5obHMubmV4dExvYWRMZXZlbCxuZXh0TGV2ZWwgPSB0aGlzLmxldmVsc1tuZXh0TGV2ZWxJZF07XG4gICAgICBpZih0aGlzLmhscy5zdGF0cy5mcmFnTGFzdEticHMgJiYgdGhpcy5mcmFnKSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSB0aGlzLmZyYWcuZHVyYXRpb24qbmV4dExldmVsLmJpdHJhdGUvKDEwMDAqdGhpcy5obHMuc3RhdHMuZnJhZ0xhc3RLYnBzKSsxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZldGNoZGVsYXk6JytmZXRjaGRlbGF5KTtcbiAgICAvLyBmaW5kIGJ1ZmZlciByYW5nZSB0aGF0IHdpbGwgYmUgcmVhY2hlZCBvbmNlIG5ldyBmcmFnbWVudCB3aWxsIGJlIGZldGNoZWRcbiAgICBuZXh0UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUgKyBmZXRjaGRlbGF5KTtcbiAgICBpZihuZXh0UmFuZ2UpIHtcbiAgICAgIC8vIHdlIGNhbiBmbHVzaCBidWZmZXIgcmFuZ2UgZm9sbG93aW5nIHRoaXMgb25lIHdpdGhvdXQgc3RhbGxpbmcgcGxheWJhY2tcbiAgICAgIG5leHRSYW5nZSA9IHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UobmV4dFJhbmdlKTtcbiAgICAgIGlmKG5leHRSYW5nZSkge1xuICAgICAgICAvLyBmbHVzaCBwb3NpdGlvbiBpcyB0aGUgc3RhcnQgcG9zaXRpb24gb2YgdGhpcyBuZXcgYnVmZmVyXG4gICAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHsgc3RhcnQgOiBuZXh0UmFuZ2Uuc3RhcnQsIGVuZCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgfVxuICAgIH1cbiAgICBpZih0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgICAvLyB0cmlnZ2VyIGEgc291cmNlQnVmZmVyIGZsdXNoXG4gICAgICB0aGlzLnN0YXRlID0gdGhpcy5CVUZGRVJfRkxVU0hJTkc7XG4gICAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgICAgdGhpcy5mcmFnTG9hZElkeCs9Mip0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uTVNFQXR0YWNoZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMudmlkZW8gPSBkYXRhLnZpZGVvO1xuICAgIHRoaXMubWVkaWFTb3VyY2UgPSBkYXRhLm1lZGlhU291cmNlO1xuICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub25WaWRlb1NlZWtpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udnNlZWtlZCA9IHRoaXMub25WaWRlb1NlZWtlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252bWV0YWRhdGEgPSB0aGlzLm9uVmlkZW9NZXRhZGF0YS5iaW5kKHRoaXMpO1xuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsdGhpcy5vbnZzZWVraW5nKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsdGhpcy5vbnZzZWVrZWQpO1xuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLHRoaXMub252bWV0YWRhdGEpO1xuICAgIGlmKHRoaXMubGV2ZWxzICYmIHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICB9XG4gIG9uVmlkZW9TZWVraW5nKCkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuTE9BRElORykge1xuICAgICAgLy8gY2hlY2sgaWYgY3VycmVudGx5IGxvYWRlZCBmcmFnbWVudCBpcyBpbnNpZGUgYnVmZmVyLlxuICAgICAgLy9pZiBvdXRzaWRlLCBjYW5jZWwgZnJhZ21lbnQgbG9hZGluZywgb3RoZXJ3aXNlIGRvIG5vdGhpbmdcbiAgICAgIGlmKHRoaXMuYnVmZmVySW5mbyh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKS5sZW4gPT09IDApIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgICB0aGlzLmZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICAgIC8vIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIGxvYWQgbmV3IGZyYWdtZW50XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy52aWRlby5jdXJyZW50VGltZTtcbiAgICB9XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBwcm9jZXNzaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblZpZGVvU2Vla2VkKCkge1xuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgRlJBR01FTlRfUExBWUlORyB0cmlnZ2VyaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblZpZGVvTWV0YWRhdGEoKSB7XG4gICAgICBpZih0aGlzLnZpZGVvLmN1cnJlbnRUaW1lICE9PSB0aGlzLnN0YXJ0UG9zaXRpb24pIHtcbiAgICAgICAgdGhpcy52aWRlby5jdXJyZW50VGltZSA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICB9XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IHRydWU7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1hbmlmZXN0UGFyc2VkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgYWFjPWZhbHNlLCBoZWFhYz1mYWxzZSxjb2RlY3M7XG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAvLyBkZXRlY3QgaWYgd2UgaGF2ZSBkaWZmZXJlbnQga2luZCBvZiBhdWRpbyBjb2RlY3MgdXNlZCBhbW9uZ3N0IHBsYXlsaXN0c1xuICAgICAgY29kZWNzID0gbGV2ZWwuY29kZWNzO1xuICAgICAgaWYoY29kZWNzKSB7XG4gICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEpIHtcbiAgICAgICAgICBhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpIHtcbiAgICAgICAgICBoZWFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmF1ZGlvY29kZWNzd2l0Y2ggPSAoYWFjICYmIGhlYWFjKTtcbiAgICBpZih0aGlzLmF1ZGlvY29kZWNzd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBhdWRpbyBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgICBpZih0aGlzLnZpZGVvICYmIHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIG5ld0xldmVsRGV0YWlscyA9IGRhdGEuZGV0YWlscyxcbiAgICAgICAgZHVyYXRpb24gPSBuZXdMZXZlbERldGFpbHMudG90YWxkdXJhdGlvbixcbiAgICAgICAgbmV3TGV2ZWxJZCA9IGRhdGEubGV2ZWwsXG4gICAgICAgIG5ld0xldmVsID0gdGhpcy5sZXZlbHNbbmV3TGV2ZWxJZF0sXG4gICAgICAgIGN1ckxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0sXG4gICAgICAgIHNsaWRpbmcgPSAwO1xuICAgIGxvZ2dlci5sb2coYGxldmVsICR7bmV3TGV2ZWxJZH0gbG9hZGVkIFske25ld0xldmVsRGV0YWlscy5zdGFydFNOfSwke25ld0xldmVsRGV0YWlscy5lbmRTTn1dLGR1cmF0aW9uOiR7ZHVyYXRpb259YCk7XG4gICAgLy8gY2hlY2sgaWYgcGxheWxpc3QgaXMgYWxyZWFkeSBsb2FkZWQgKGlmIHllcywgaXQgc2hvdWxkIGJlIGEgbGl2ZSBwbGF5bGlzdClcbiAgICBpZihjdXJMZXZlbCAmJiBjdXJMZXZlbC5kZXRhaWxzICYmIGN1ckxldmVsLmRldGFpbHMubGl2ZSkge1xuICAgICAgdmFyIGN1ckxldmVsRGV0YWlscyA9IGN1ckxldmVsLmRldGFpbHM7XG4gICAgICAvLyAgcGxheWxpc3Qgc2xpZGluZyBpcyB0aGUgc3VtIG9mIDogY3VycmVudCBwbGF5bGlzdCBzbGlkaW5nICsgc2xpZGluZyBvZiBuZXcgcGxheWxpc3QgY29tcGFyZWQgdG8gY3VycmVudCBvbmVcbiAgICAgIC8vIGNoZWNrIHNsaWRpbmcgb2YgdXBkYXRlZCBwbGF5bGlzdCBhZ2FpbnN0IGN1cnJlbnQgb25lIDpcbiAgICAgIC8vIGFuZCBmaW5kIGl0cyBwb3NpdGlvbiBpbiBjdXJyZW50IHBsYXlsaXN0XG4gICAgICAvL2xvZ2dlci5sb2coXCJmcmFnbWVudHNbMF0uc24vdGhpcy5sZXZlbC9jdXJMZXZlbC5kZXRhaWxzLmZyYWdtZW50c1swXS5zbjpcIiArIGZyYWdtZW50c1swXS5zbiArIFwiL1wiICsgdGhpcy5sZXZlbCArIFwiL1wiICsgY3VyTGV2ZWwuZGV0YWlscy5mcmFnbWVudHNbMF0uc24pO1xuICAgICAgdmFyIFNOZGlmZiA9IG5ld0xldmVsRGV0YWlscy5zdGFydFNOIC0gY3VyTGV2ZWxEZXRhaWxzLnN0YXJ0U047XG4gICAgICBpZihTTmRpZmYgPj0wKSB7XG4gICAgICAgIC8vIHBvc2l0aXZlIHNsaWRpbmcgOiBuZXcgcGxheWxpc3Qgc2xpZGluZyB3aW5kb3cgaXMgYWZ0ZXIgcHJldmlvdXMgb25lXG4gICAgICAgIHZhciBvbGRmcmFnbWVudHMgPSBjdXJMZXZlbERldGFpbHMuZnJhZ21lbnRzO1xuICAgICAgICBpZiggU05kaWZmIDwgb2xkZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgIHNsaWRpbmcgPSBjdXJMZXZlbERldGFpbHMuc2xpZGluZyArIG9sZGZyYWdtZW50c1tTTmRpZmZdLnN0YXJ0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ2dlci5sb2coYGNhbm5vdCBjb21wdXRlIHNsaWRpbmcsIG5vIFNOIGluIGNvbW1vbiBiZXR3ZWVuIG9sZC9uZXcgbGV2ZWw6WyR7Y3VyTGV2ZWxEZXRhaWxzLnN0YXJ0U059LCR7Y3VyTGV2ZWxEZXRhaWxzLmVuZFNOfV0vWyR7bmV3TGV2ZWxEZXRhaWxzLnN0YXJ0U059LCR7bmV3TGV2ZWxEZXRhaWxzLmVuZFNOfV1gKTtcbiAgICAgICAgICBzbGlkaW5nID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBuZWdhdGl2ZSBzbGlkaW5nOiBuZXcgcGxheWxpc3Qgc2xpZGluZyB3aW5kb3cgaXMgYmVmb3JlIHByZXZpb3VzIG9uZVxuICAgICAgICBzbGlkaW5nID0gY3VyTGV2ZWxEZXRhaWxzLnNsaWRpbmcgLSBuZXdMZXZlbERldGFpbHMuZnJhZ21lbnRzWy1TTmRpZmZdLnN0YXJ0O1xuICAgICAgfVxuICAgICAgaWYoc2xpZGluZykge1xuICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0IHNsaWRpbmc6JHtzbGlkaW5nLnRvRml4ZWQoMyl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIG92ZXJyaWRlIGxldmVsIGluZm9cbiAgICBuZXdMZXZlbC5kZXRhaWxzID0gbmV3TGV2ZWxEZXRhaWxzO1xuICAgIG5ld0xldmVsLmRldGFpbHMuc2xpZGluZyA9IHNsaWRpbmc7XG4gICAgaWYodGhpcy5zdGFydExldmVsTG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tM1xuICAgICAgaWYobmV3TGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCxkdXJhdGlvbiAtIDMgKiBuZXdMZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgfVxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gb25seSBzd2l0Y2ggYmF0Y2sgdG8gSURMRSBzdGF0ZSBpZiB3ZSB3ZXJlIHdhaXRpbmcgZm9yIGxldmVsIHRvIHN0YXJ0IGRvd25sb2FkaW5nIGEgbmV3IGZyYWdtZW50XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gdGhpcy5XQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuTE9BRElORykge1xuICAgICAgaWYodGhpcy5mcmFnbWVudEJpdHJhdGVUZXN0ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgLi4uIHdlIGp1c3QgbG9hZGVkIGEgZnJhZ21lbnQgdG8gZGV0ZXJtaW5lIGFkZXF1YXRlIHN0YXJ0IGJpdHJhdGUgYW5kIGluaXRpYWxpemUgYXV0b3N3aXRjaCBhbGdvXG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9IGZhbHNlO1xuICAgICAgICBkYXRhLnN0YXRzLnRwYXJzZWQgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwgeyBzdGF0cyA6IGRhdGEuc3RhdHMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLlBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSwgZGV0YWlscyA9IGN1cnJlbnRMZXZlbC5kZXRhaWxzLCAgZHVyYXRpb24gPSAgZGV0YWlscy50b3RhbGR1cmF0aW9uLCBzdGFydCA9IHRoaXMuZnJhZy5zdGFydDtcbiAgICAgICAgaWYoZGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgZHVyYXRpb24rPWRldGFpbHMuc2xpZGluZztcbiAgICAgICAgICBzdGFydCs9ZGV0YWlscy5zbGlkaW5nO1xuICAgICAgICB9XG4gICAgICAgIGlmKHRoaXMuZnJhZy5kcmlmdCkge1xuICAgICAgICAgIHN0YXJ0Kz0gdGhpcy5mcmFnLmRyaWZ0O1xuICAgICAgICB9XG4gICAgICAgIGxvZ2dlci5sb2coYERlbXV4aW5nICAgICAgJHt0aGlzLmZyYWcuc259IG9mIFske2RldGFpbHMuc3RhcnRTTn0gLCR7ZGV0YWlscy5lbmRTTn1dLGxldmVsICR7dGhpcy5sZXZlbH1gKTtcbiAgICAgICAgdGhpcy5kZW11eGVyLnB1c2goZGF0YS5wYXlsb2FkLGN1cnJlbnRMZXZlbC5hdWRpb0NvZGVjLGN1cnJlbnRMZXZlbC52aWRlb0NvZGVjLHN0YXJ0LHRoaXMuZnJhZy5jYywgdGhpcy5sZXZlbCwgZHVyYXRpb24pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uSW5pdFNlZ21lbnQoZXZlbnQsZGF0YSkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuUEFSU0lORykge1xuICAgICAgLy8gY2hlY2sgaWYgY29kZWNzIGhhdmUgYmVlbiBleHBsaWNpdGVseSBkZWZpbmVkIGluIHRoZSBtYXN0ZXIgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWw7XG4gICAgICAvLyBpZiB5ZXMgdXNlIHRoZXNlIG9uZXMgaW5zdGVhZCBvZiB0aGUgb25lcyBwYXJzZWQgZnJvbSB0aGUgZGVtdXhcbiAgICAgIHZhciBhdWRpb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uYXVkaW9Db2RlYywgdmlkZW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWMsc2I7XG4gICAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGxldmVsIEEvViBjb2RlY3M6JyArIGF1ZGlvQ29kZWMgKyAnLCcgKyB2aWRlb0NvZGVjKTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncGxheWxpc3QgY29kZWNzOicgKyBjb2RlYyk7XG4gICAgICAvLyBpZiBwbGF5bGlzdCBkb2VzIG5vdCBzcGVjaWZ5IGNvZGVjcywgdXNlIGNvZGVjcyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50XG4gICAgICBpZihhdWRpb0NvZGVjID09PSB1bmRlZmluZWQgfHwgZGF0YS5hdWRpb2NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXVkaW9Db2RlYyA9IGRhdGEuYXVkaW9Db2RlYztcbiAgICAgIH1cbiAgICAgIGlmKHZpZGVvQ29kZWMgPT09IHVuZGVmaW5lZCAgfHwgZGF0YS52aWRlb2NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICAgIH1cbiAgICAgIC8vIGluIGNhc2Ugc2V2ZXJhbCBhdWRpbyBjb2RlY3MgbWlnaHQgYmUgdXNlZCwgZm9yY2UgSEUtQUFDIGZvciBhdWRpbyAoc29tZSBicm93c2VycyBkb24ndCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaClcbiAgICAgIC8vZG9uJ3QgZG8gaXQgZm9yIG1vbm8gc3RyZWFtcyAuLi5cbiAgICAgIGlmKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCAmJiBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID09PSAyICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhbmRyb2lkJykgPT09IC0xICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgIH1cbiAgICAgIGlmKCF0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IHt9O1xuICAgICAgICBsb2dnZXIubG9nKGBzZWxlY3RlZCBBL1YgY29kZWNzIGZvciBzb3VyY2VCdWZmZXJzOiR7YXVkaW9Db2RlY30sJHt2aWRlb0NvZGVjfWApO1xuICAgICAgICAvLyBjcmVhdGUgc291cmNlIEJ1ZmZlciBhbmQgbGluayB0aGVtIHRvIE1lZGlhU291cmNlXG4gICAgICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHthdWRpb0NvZGVjfWApO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9XG4gICAgICAgIGlmKHZpZGVvQ29kZWMpIHtcbiAgICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLnZpZGVvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHt2aWRlb0NvZGVjfWApO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZihhdWRpb0NvZGVjKSB7XG4gICAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiAnYXVkaW8nLCBkYXRhIDogZGF0YS5hdWRpb01vb3Z9KTtcbiAgICAgIH1cbiAgICAgIGlmKHZpZGVvQ29kZWMpIHtcbiAgICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6ICd2aWRlbycsIGRhdGEgOiBkYXRhLnZpZGVvTW9vdn0pO1xuICAgICAgfVxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdtZW50UGFyc2luZyhldmVudCxkYXRhKSB7XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gdGhpcy5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnRwYXJzZTIgPSBEYXRlLm5vdygpO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgICBpZihsZXZlbC5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdmFyIGZyYWdtZW50cyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmRldGFpbHMuZnJhZ21lbnRzO1xuICAgICAgICB2YXIgc24wID0gZnJhZ21lbnRzWzBdLnNuLHNuMSA9IGZyYWdtZW50c1tmcmFnbWVudHMubGVuZ3RoLTFdLnNuLCBzbiA9IHRoaXMuZnJhZy5zbjtcbiAgICAgICAgLy9yZXRyaWV2ZSB0aGlzLmZyYWcuc24gaW4gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF1cbiAgICAgICAgaWYoc24gPj0gc24wICYmIHNuIDw9IHNuMSkge1xuICAgICAgICAgIGxldmVsLmRldGFpbHMuc2xpZGluZyA9IGRhdGEuc3RhcnRQVFMgLSBmcmFnbWVudHNbc24tc24wXS5zdGFydDtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coYGxpdmUgcGxheWxpc3Qgc2xpZGluZzoke2xldmVsLmRldGFpbHMuc2xpZGluZy50b0ZpeGVkKDMpfWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsb2dnZXIubG9nKGAgICAgICBwYXJzZWQgZGF0YSwgdHlwZS9zdGFydFBUUy9lbmRQVFMvc3RhcnREVFMvZW5kRFRTL25iOiR7ZGF0YS50eXBlfS8ke2RhdGEuc3RhcnRQVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZFBUUy50b0ZpeGVkKDMpfS8ke2RhdGEuc3RhcnREVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZERUUy50b0ZpeGVkKDMpfS8ke2RhdGEubmJ9YCk7XG4gICAgICB0aGlzLmZyYWcuZHJpZnQ9ZGF0YS5zdGFydFBUUy10aGlzLmZyYWcuc3RhcnQ7XG4gICAgICAvL2xvZ2dlci5sb2coYCAgICAgIGRyaWZ0OiR7dGhpcy5mcmFnLmRyaWZ0LnRvRml4ZWQoMyl9YCk7XG4gICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogZGF0YS50eXBlLCBkYXRhIDogZGF0YS5tb29mfSk7XG4gICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogZGF0YS50eXBlLCBkYXRhIDogZGF0YS5tZGF0fSk7XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSBkYXRhLmVuZFBUUztcbiAgICAgIHRoaXMuYnVmZmVyUmFuZ2UucHVzaCh7dHlwZSA6IGRhdGEudHlwZSwgc3RhcnQgOiBkYXRhLnN0YXJ0UFRTLCBlbmQgOiBkYXRhLmVuZFBUUywgZnJhZyA6IHRoaXMuZnJhZ30pO1xuICAgICAgLy8gaWYoZGF0YS50eXBlID09PSAndmlkZW8nKSB7XG4gICAgICAvLyAgIHRoaXMuZnJhZy5mcHNFeHBlY3RlZCA9IChkYXRhLm5iLTEpIC8gKGRhdGEuZW5kUFRTIC0gZGF0YS5zdGFydFBUUyk7XG4gICAgICAvLyB9XG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2Fybihgbm90IGluIFBBUlNJTkcgc3RhdGUsIGRpc2NhcmRpbmcgJHtldmVudH1gKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdtZW50UGFyc2VkKCkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuUEFSU0lORykge1xuICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuUEFSU0VEO1xuICAgICAgdGhpcy5zdGF0cy50cGFyc2VkID0gbmV3IERhdGUoKTtcbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihldmVudCxkYXRhKSB7XG4gICAgc3dpdGNoKGRhdGEuZGV0YWlscykge1xuICAgICAgLy8gYWJvcnQgZnJhZ21lbnQgbG9hZGluZyBvbiBlcnJvcnNcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUOlxuICAgICAgICAvLyBpZiBmYXRhbCBlcnJvciwgc3RvcCBwcm9jZXNzaW5nLCBvdGhlcndpc2UgbW92ZSB0byBJRExFIHRvIHJldHJ5IGxvYWRpbmdcbiAgICAgICAgbG9nZ2VyLndhcm4oYGJ1ZmZlciBjb250cm9sbGVyOiAke2RhdGEuZGV0YWlsc30gd2hpbGUgbG9hZGluZyBmcmFnLHN3aXRjaCB0byAke2RhdGEuZmF0YWwgPyAnRVJST1InIDogJ0lETEUnfSBzdGF0ZSAuLi5gKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IGRhdGEuZmF0YWwgPyB0aGlzLkVSUk9SIDogdGhpcy5JRExFO1xuICAgICAgICB0aGlzLmZyYWcgPSBudWxsO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIG9uU291cmNlQnVmZmVyVXBkYXRlRW5kKCkge1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuQVBQRU5ESU5HICYmIHRoaXMubXA0c2VnbWVudHMubGVuZ3RoID09PSAwKSAge1xuICAgICAgaWYodGhpcy5mcmFnKSB7XG4gICAgICAgIHRoaXMuc3RhdHMudGJ1ZmZlcmVkID0gbmV3IERhdGUoKTtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7IHN0YXRzIDogdGhpcy5zdGF0cywgZnJhZyA6IHRoaXMuZnJhZ30pO1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uU291cmNlQnVmZmVyRXJyb3IoZXZlbnQpIHtcbiAgICAgIGxvZ2dlci5lcnJvcihgc291cmNlQnVmZmVyIGVycm9yOiR7ZXZlbnR9YCk7XG4gICAgICB0aGlzLnN0YXRlID0gdGhpcy5FUlJPUjtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0FQUEVORElOR19FUlJPUiwgZmF0YWw6dHJ1ZSwgZnJhZyA6IHRoaXMuZnJhZ30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckNvbnRyb2xsZXI7XG4iLCIvKlxuICogbGV2ZWwgY29udHJvbGxlclxuICpcbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbiBpbXBvcnQge0Vycm9yVHlwZXMsRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgTGV2ZWxDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmxwID0gdGhpcy5vbkZyYWdtZW50TG9hZFByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmVyciA9IHRoaXMub25FcnJvci5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTUFOSUZFU1RfTE9BREVELCB0aGlzLm9ubWwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywgdGhpcy5vbmZscCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19MT0FEX1BST0dSRVNTLCB0aGlzLm9uZmxwKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgaWYodGhpcy50aW1lcikge1xuICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIH1cbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IC0xO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIGxldmVscyA9IFtdLGJpdHJhdGVTdGFydCxpLGJpdHJhdGVTZXQ9e307XG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICB2YXIgcmVkdW5kYW50TGV2ZWxJZCA9IGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV07XG4gICAgICBpZihyZWR1bmRhbnRMZXZlbElkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXSA9IGxldmVscy5sZW5ndGg7XG4gICAgICAgIGxldmVsLnVybCA9IFtsZXZlbC51cmxdO1xuICAgICAgICBsZXZlbC51cmxJZCA9IDA7XG4gICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVsc1tyZWR1bmRhbnRMZXZlbElkXS51cmwucHVzaChsZXZlbC51cmwpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIHN0YXJ0IGJpdHJhdGUgaXMgdGhlIGZpcnN0IGJpdHJhdGUgb2YgdGhlIG1hbmlmZXN0XG4gICAgYml0cmF0ZVN0YXJ0ID0gbGV2ZWxzWzBdLmJpdHJhdGU7XG4gICAgLy8gc29ydCBsZXZlbCBvbiBiaXRyYXRlXG4gICAgbGV2ZWxzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHJldHVybiBhLmJpdHJhdGUtYi5iaXRyYXRlO1xuICAgIH0pO1xuICAgIHRoaXMuX2xldmVscyA9IGxldmVscztcblxuICAgIC8vIGZpbmQgaW5kZXggb2YgZmlyc3QgbGV2ZWwgaW4gc29ydGVkIGxldmVsc1xuICAgIGZvcihpPTA7IGkgPCBsZXZlbHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICBpZihsZXZlbHNbaV0uYml0cmF0ZSA9PT0gYml0cmF0ZVN0YXJ0KSB7XG4gICAgICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBpO1xuICAgICAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBsb2FkZWQsJHtsZXZlbHMubGVuZ3RofSBsZXZlbChzKSBmb3VuZCwgZmlyc3QgYml0cmF0ZToke2JpdHJhdGVTdGFydH1gKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfUEFSU0VELFxuICAgICAgICAgICAgICAgICAgICB7IGxldmVscyA6IHRoaXMuX2xldmVscyxcbiAgICAgICAgICAgICAgICAgICAgICBmaXJzdExldmVsIDogdGhpcy5fZmlyc3RMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IGRhdGEuc3RhdHNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWxzO1xuICB9XG5cbiAgZ2V0IGxldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbDtcbiAgfVxuXG4gIHNldCBsZXZlbChuZXdMZXZlbCkge1xuICAgIGlmKHRoaXMuX2xldmVsICE9PSBuZXdMZXZlbCB8fCB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdLmRldGFpbHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zZXRMZXZlbEludGVybmFsKG5ld0xldmVsKTtcbiAgICB9XG4gIH1cblxuIHNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpIHtcbiAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICBpZihuZXdMZXZlbCA+PSAwICYmIG5ld0xldmVsIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2xldmVsID0gbmV3TGV2ZWw7XG4gICAgICBsb2dnZXIubG9nKGBzd2l0Y2hpbmcgdG8gbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfU1dJVENILCB7IGxldmVsIDogbmV3TGV2ZWx9KTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tuZXdMZXZlbF07XG4gICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsXG4gICAgICBpZihsZXZlbC5kZXRhaWxzID09PSB1bmRlZmluZWQgfHwgbGV2ZWwuZGV0YWlscy5saXZlID09PSB0cnVlKSB7XG4gICAgICAgIC8vIGxldmVsIG5vdCByZXRyaWV2ZWQgeWV0LCBvciBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gKHJlKWxvYWQgaXRcbiAgICAgICAgbG9nZ2VyLmxvZyhgKHJlKWxvYWRpbmcgcGxheWxpc3QgZm9yIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICAgIHZhciB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHsgdXJsIDogbGV2ZWwudXJsW3VybElkXSwgbGV2ZWwgOiBuZXdMZXZlbCwgaWQgOiB1cmxJZH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnZhbGlkIGxldmVsIGlkIGdpdmVuLCB0cmlnZ2VyIGVycm9yXG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk9USEVSX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTEVWRUxfU1dJVENIX0VSUk9SLCBsZXZlbCA6IG5ld0xldmVsLCBmYXRhbDpmYWxzZSwgcmVhc29uOiAnaW52YWxpZCBsZXZlbCBpZHgnfSk7XG4gICAgfVxuIH1cblxuXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gIH1cblxuICBzZXQgbWFudWFsTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIGlmKG5ld0xldmVsICE9PS0xKSB7XG4gICAgICB0aGlzLmxldmVsID0gbmV3TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgfVxuXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgaWYodGhpcy5fc3RhcnRMZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZFByb2dyZXNzKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgIGlmKHN0YXRzLmFib3J0ZWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbiA9IChuZXcgRGF0ZSgpIC0gc3RhdHMudHJlcXVlc3QpLzEwMDA7XG4gICAgICB0aGlzLmxhc3RmZXRjaGxldmVsID0gZGF0YS5mcmFnLmxldmVsO1xuICAgICAgdGhpcy5sYXN0YncgPSBzdGF0cy5sb2FkZWQqOC90aGlzLmxhc3RmZXRjaGR1cmF0aW9uO1xuICAgICAgLy9jb25zb2xlLmxvZyhgZmV0Y2hEdXJhdGlvbjoke3RoaXMubGFzdGZldGNoZHVyYXRpb259LGJ3OiR7KHRoaXMubGFzdGJ3LzEwMDApLnRvRml4ZWQoMCl9LyR7c3RhdHMuYWJvcnRlZH1gKTtcbiAgICB9XG4gIH1cblxuICBvbkVycm9yKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgZGV0YWlscyA9IGRhdGEuZGV0YWlscyxsZXZlbElkLGxldmVsO1xuICAgIC8vIHRyeSB0byByZWNvdmVyIG5vdCBmYXRhbCBlcnJvcnNcbiAgICBzd2l0Y2goZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUjpcbiAgICAgICAgIGxldmVsSWQgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGxldmVsSWQgPSBkYXRhLmxldmVsO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvKiB0cnkgdG8gc3dpdGNoIHRvIGEgcmVkdW5kYW50IHN0cmVhbSBpZiBhbnkgYXZhaWxhYmxlLlxuICAgICAqIGlmIG5vIHJlZHVuZGFudCBzdHJlYW0gYXZhaWxhYmxlLCBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gKGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgMClcbiAgICAgKiBvdGhlcndpc2UsIHdlIGNhbm5vdCByZWNvdmVyIHRoaXMgbmV0d29yayBlcnJvciAuLi4uXG4gICAgICovXG4gICAgaWYobGV2ZWxJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsZXZlbCA9IHRoaXMuX2xldmVsc1tsZXZlbElkXTtcbiAgICAgIGlmKGxldmVsLnVybElkIDwgbGV2ZWwudXJsLmxlbmd0aC0xKSB7XG4gICAgICAgIGxldmVsLnVybElkKys7XG4gICAgICAgIGxldmVsLmRldGFpbHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gZm9yIGxldmVsICR7bGV2ZWxJZH06IHN3aXRjaGluZyB0byByZWR1bmRhbnQgc3RyZWFtIGlkICR7bGV2ZWwudXJsSWR9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBjb3VsZCB0cnkgdG8gcmVjb3ZlciBpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IGxvd2VzdCBsZXZlbCAoMClcbiAgICAgICAgbGV0IHJlY292ZXJhYmxlID0gKCh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpICYmIGxldmVsSWQpO1xuICAgICAgICBpZihyZWNvdmVyYWJsZSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc306IGVtZXJnZW5jeSBzd2l0Y2gtZG93biBmb3IgbmV4dCBmcmFnbWVudGApO1xuICAgICAgICAgIHRoaXMubGFzdGJ3ID0gMDtcbiAgICAgICAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYGNhbm5vdCByZWNvdmVyICR7ZGV0YWlsc30gZXJyb3JgKTtcbiAgICAgICAgICB0aGlzLl9sZXZlbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgICAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICAgICAgICAvLyByZWRpc3BhdGNoIHNhbWUgZXJyb3IgYnV0IHdpdGggZmF0YWwgc2V0IHRvIHRydWVcbiAgICAgICAgICAgIGRhdGEuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihldmVudCxkYXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IHBsYXlsaXN0IGlzIGEgbGl2ZSBwbGF5bGlzdFxuICAgIGlmKGRhdGEuZGV0YWlscy5saXZlICYmICF0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0IHdlIHdpbGwgaGF2ZSB0byByZWxvYWQgaXQgcGVyaW9kaWNhbGx5XG4gICAgICAvLyBzZXQgcmVsb2FkIHBlcmlvZCB0byBwbGF5bGlzdCB0YXJnZXQgZHVyYXRpb25cbiAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9udGljaywgMTAwMCpkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdmFyIGxldmVsSWQgPSB0aGlzLl9sZXZlbDtcbiAgICBpZihsZXZlbElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tsZXZlbElkXSwgdXJsSWQgPSBsZXZlbC51cmxJZDtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywgeyB1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsIDogbGV2ZWxJZCwgaWQgOiB1cmxJZCB9KTtcbiAgICB9XG4gIH1cblxuICBuZXh0TG9hZExldmVsKCkge1xuICAgIGlmKHRoaXMuX21hbnVhbExldmVsICE9PSAtMSkge1xuICAgICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgIHJldHVybiB0aGlzLm5leHRBdXRvTGV2ZWwoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0QXV0b0xldmVsKCkge1xuICAgIHZhciBsYXN0YncgPSB0aGlzLmxhc3RidyxhZGp1c3RlZGJ3LGksbWF4QXV0b0xldmVsO1xuICAgIGlmKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9sZXZlbHMubGVuZ3RoLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IoaSA9MDsgaSA8PSBtYXhBdXRvTGV2ZWwgOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmKGkgPD0gdGhpcy5fbGV2ZWwpIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuOCpsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43Kmxhc3RidztcbiAgICAgIH1cbiAgICAgIGlmKGFkanVzdGVkYncgPCB0aGlzLl9sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCxpLTEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaS0xO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcbiIsIiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyICAgICAgICAgICAgZnJvbSAnLi90c2RlbXV4ZXInO1xuIGltcG9ydCBUU0RlbXV4ZXJXb3JrZXIgICAgICBmcm9tICcuL3RzZGVtdXhlcndvcmtlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcbiAgICBpZihjb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ1RTIGRlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoVFNEZW11eGVyV29ya2VyKTtcbiAgICAgICAgICB0aGlzLm9ud21zZyA9IHRoaXMub25Xb3JrZXJNZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgICAgICAgdGhpcy53LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ2luaXQnfSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKCdlcnJvciB3aGlsZSBpbml0aWFsaXppbmcgVFNEZW11eGVyV29ya2VyLCBmYWxsYmFjayBvbiByZWd1bGFyIFRTRGVtdXhlcicpO1xuICAgICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IFRTRGVtdXhlcigpO1xuICAgICAgfVxuICAgICAgdGhpcy5kZW11eEluaXRpYWxpemVkID0gdHJ1ZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICB0aGlzLncucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgZHVyYXRpb24pIHtcbiAgICBpZih0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdkZW11eCcgLCBkYXRhIDogZGF0YSwgYXVkaW9Db2RlYyA6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQgOiB0aW1lT2Zmc2V0LCBjYzogY2MsIGxldmVsIDogbGV2ZWwsIGR1cmF0aW9uIDogZHVyYXRpb259LFtkYXRhXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEpLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIGR1cmF0aW9uKTtcbiAgICAgIHRoaXMuZGVtdXhlci5lbmQoKTtcbiAgICB9XG4gIH1cblxuICBvbldvcmtlck1lc3NhZ2UoZXYpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdvbldvcmtlck1lc3NhZ2U6JyArIGV2LmRhdGEuZXZlbnQpO1xuICAgIHN3aXRjaChldi5kYXRhLmV2ZW50KSB7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQ6XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgaWYoZXYuZGF0YS5hdWRpb01vb3YpIHtcbiAgICAgICAgICBvYmouYXVkaW9Nb292ID0gbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5hdWRpb01vb3YpO1xuICAgICAgICAgIG9iai5hdWRpb0NvZGVjID0gZXYuZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICAgIG9iai5hdWRpb0NoYW5uZWxDb3VudCA9IGV2LmRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYoZXYuZGF0YS52aWRlb01vb3YpIHtcbiAgICAgICAgICBvYmoudmlkZW9Nb292ID0gbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS52aWRlb01vb3YpO1xuICAgICAgICAgIG9iai52aWRlb0NvZGVjID0gZXYuZGF0YS52aWRlb0NvZGVjO1xuICAgICAgICAgIG9iai52aWRlb1dpZHRoID0gZXYuZGF0YS52aWRlb1dpZHRoO1xuICAgICAgICAgIG9iai52aWRlb0hlaWdodCA9IGV2LmRhdGEudmlkZW9IZWlnaHQ7XG4gICAgICAgIH1cbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBvYmopO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0RBVEE6XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgICAgIG1vb2YgOiBuZXcgVWludDhBcnJheShldi5kYXRhLm1vb2YpLFxuICAgICAgICAgIG1kYXQgOiBuZXcgVWludDhBcnJheShldi5kYXRhLm1kYXQpLFxuICAgICAgICAgIHN0YXJ0UFRTIDogZXYuZGF0YS5zdGFydFBUUyxcbiAgICAgICAgICBlbmRQVFMgOiBldi5kYXRhLmVuZFBUUyxcbiAgICAgICAgICBzdGFydERUUyA6IGV2LmRhdGEuc3RhcnREVFMsXG4gICAgICAgICAgZW5kRFRTIDogZXYuZGF0YS5lbmREVFMsXG4gICAgICAgICAgdHlwZSA6IGV2LmRhdGEudHlwZSxcbiAgICAgICAgICBuYiA6IGV2LmRhdGEubmJcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihldi5kYXRhLmV2ZW50LGV2LmRhdGEuZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcjtcbiIsIi8qKlxuICogUGFyc2VyIGZvciBleHBvbmVudGlhbCBHb2xvbWIgY29kZXMsIGEgdmFyaWFibGUtYml0d2lkdGggbnVtYmVyIGVuY29kaW5nXG4gKiBzY2hlbWUgdXNlZCBieSBoMjY0LlxuICovXG5cbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXhwR29sb21iIHtcblxuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGlzLmRhdGFcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlID0gdGhpcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgLy8gdGhlIGN1cnJlbnQgd29yZCBiZWluZyBleGFtaW5lZFxuICAgIHRoaXMud29yZCA9IDA7IC8vIDp1aW50XG4gICAgLy8gdGhlIG51bWJlciBvZiBiaXRzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGUgY3VycmVudCB3b3JkXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlID0gMDsgLy8gOnVpbnRcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgbG9hZFdvcmQoKSB7XG4gICAgdmFyXG4gICAgICBwb3NpdGlvbiA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoIC0gdGhpcy5ieXRlc0F2YWlsYWJsZSxcbiAgICAgIHdvcmtpbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KDQpLFxuICAgICAgYXZhaWxhYmxlQnl0ZXMgPSBNYXRoLm1pbig0LCB0aGlzLmJ5dGVzQXZhaWxhYmxlKTtcblxuICAgIGlmIChhdmFpbGFibGVCeXRlcyA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdubyBieXRlcyBhdmFpbGFibGUnKTtcbiAgICB9XG5cbiAgICB3b3JraW5nQnl0ZXMuc2V0KHRoaXMuZGF0YS5zdWJhcnJheShwb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uICsgYXZhaWxhYmxlQnl0ZXMpKTtcbiAgICB0aGlzLndvcmQgPSBuZXcgRGF0YVZpZXcod29ya2luZ0J5dGVzLmJ1ZmZlcikuZ2V0VWludDMyKDApO1xuXG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLmRhdGEgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IGNvdW50KSB7XG4gICAgICB0aGlzLndvcmQgICAgICAgICAgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLmJpdHNBdmFpbGFibGU7XG4gICAgICBza2lwQnl0ZXMgPSBjb3VudCA+PiAzO1xuXG4gICAgICBjb3VudCAtPSAoc2tpcEJ5dGVzID4+IDMpO1xuICAgICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBza2lwQnl0ZXM7XG5cbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcblxuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9XG4gIH1cblxuICAvLyAoc2l6ZTppbnQpOnVpbnRcbiAgcmVhZEJpdHMoc2l6ZSkge1xuICAgIHZhclxuICAgICAgYml0cyA9IE1hdGgubWluKHRoaXMuYml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcblxuICAgIGlmKHNpemUgPjMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cblxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBiaXRzO1xuICAgIGlmICh0aGlzLmJpdHNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGJpdHM7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ5dGVzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIH1cblxuICAgIGJpdHMgPSBzaXplIC0gYml0cztcbiAgICBpZiAoYml0cyA+IDApIHtcbiAgICAgIHJldHVybiB2YWx1IDw8IGJpdHMgfCB0aGlzLnJlYWRCaXRzKGJpdHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdmFsdTtcbiAgICB9XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHNraXBMWigpIHtcbiAgICB2YXIgbGVhZGluZ1plcm9Db3VudDsgLy8gOnVpbnRcbiAgICBmb3IgKGxlYWRpbmdaZXJvQ291bnQgPSAwIDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMuYml0c0F2YWlsYWJsZSA7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmQgJiAoMHg4MDAwMDAwMCA+Pj4gbGVhZGluZ1plcm9Db3VudCkpKSB7XG4gICAgICAgIC8vIHRoZSBmaXJzdCBiaXQgb2Ygd29ya2luZyB3b3JkIGlzIDFcbiAgICAgICAgdGhpcy53b3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gd2UgZXhoYXVzdGVkIHdvcmQgYW5kIHN0aWxsIGhhdmUgbm90IGZvdW5kIGEgMVxuICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudCArIHRoaXMuc2tpcExaKCk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBVRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBFRygpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMWigpKTtcbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgcmVhZFVFRygpIHtcbiAgICB2YXIgY2x6ID0gdGhpcy5za2lwTFooKTsgLy8gOnVpbnRcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyhjbHogKyAxKSAtIDE7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZEVHKCkge1xuICAgIHZhciB2YWx1ID0gdGhpcy5yZWFkVUVHKCk7IC8vIDppbnRcbiAgICBpZiAoMHgwMSAmIHZhbHUpIHtcbiAgICAgIC8vIHRoZSBudW1iZXIgaXMgb2RkIGlmIHRoZSBsb3cgb3JkZXIgYml0IGlzIHNldFxuICAgICAgcmV0dXJuICgxICsgdmFsdSkgPj4+IDE7IC8vIGFkZCAxIHRvIG1ha2UgaXQgZXZlbiwgYW5kIGRpdmlkZSBieSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMSAqICh2YWx1ID4+PiAxKTsgLy8gZGl2aWRlIGJ5IHR3byB0aGVuIG1ha2UgaXQgbmVnYXRpdmVcbiAgICB9XG4gIH1cblxuICAvLyBTb21lIGNvbnZlbmllbmNlIGZ1bmN0aW9uc1xuICAvLyA6Qm9vbGVhblxuICByZWFkQm9vbGVhbigpIHtcbiAgICByZXR1cm4gMSA9PT0gdGhpcy5yZWFkQml0cygxKTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkVUJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH1cblxuICAvKipcbiAgICogQWR2YW5jZSB0aGUgRXhwR29sb21iIGRlY29kZXIgcGFzdCBhIHNjYWxpbmcgbGlzdC4gVGhlIHNjYWxpbmdcbiAgICogbGlzdCBpcyBvcHRpb25hbGx5IHRyYW5zbWl0dGVkIGFzIHBhcnQgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXJcbiAgICogc2V0IGFuZCBpcyBub3QgcmVsZXZhbnQgdG8gdHJhbnNtdXhpbmcuXG4gICAqIEBwYXJhbSBjb3VudCB7bnVtYmVyfSB0aGUgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhpcyBzY2FsaW5nIGxpc3RcbiAgICogQHNlZSBSZWNvbW1lbmRhdGlvbiBJVFUtVCBILjI2NCwgU2VjdGlvbiA3LjMuMi4xLjEuMVxuICAgKi9cbiAgc2tpcFNjYWxpbmdMaXN0KGNvdW50KSB7XG4gICAgdmFyXG4gICAgICBsYXN0U2NhbGUgPSA4LFxuICAgICAgbmV4dFNjYWxlID0gOCxcbiAgICAgIGosXG4gICAgICBkZWx0YVNjYWxlO1xuXG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEVHKCk7XG4gICAgICAgIG5leHRTY2FsZSA9IChsYXN0U2NhbGUgKyBkZWx0YVNjYWxlICsgMjU2KSAlIDI1NjtcbiAgICAgIH1cblxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU1BTKCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdCxsZXZlbElkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG5cbiAgICB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgIHByb2ZpbGVJZGMgPSB0aGlzLnJlYWRVQnl0ZSgpOyAvLyBwcm9maWxlX2lkY1xuICAgIHByb2ZpbGVDb21wYXQgPSB0aGlzLnJlYWRCaXRzKDUpOyAvLyBjb25zdHJhaW50X3NldFswLTRdX2ZsYWcsIHUoNSlcbiAgICB0aGlzLnNraXBCaXRzKDMpOyAvLyByZXNlcnZlZF96ZXJvXzNiaXRzIHUoMyksXG4gICAgbGV2ZWxJZGMgPSB0aGlzLnJlYWRVQnl0ZSgpOyAvL2xldmVsX2lkYyB1KDgpXG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIHNlcV9wYXJhbWV0ZXJfc2V0X2lkXG5cbiAgICAvLyBzb21lIHByb2ZpbGVzIGhhdmUgbW9yZSBvcHRpb25hbCBkYXRhIHdlIGRvbid0IG5lZWRcbiAgICBpZiAocHJvZmlsZUlkYyA9PT0gMTAwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjIgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTQ0KSB7XG4gICAgICB2YXIgY2hyb21hRm9ybWF0SWRjID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2x1bWFfbWludXM4XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2Nocm9tYV9taW51czhcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHFwcHJpbWVfeV96ZXJvX3RyYW5zZm9ybV9ieXBhc3NfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19tYXRyaXhfcHJlc2VudF9mbGFnXG4gICAgICAgIHNjYWxpbmdMaXN0Q291bnQgPSAoY2hyb21hRm9ybWF0SWRjICE9PSAzKSA/IDggOiAxMjtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNjYWxpbmdMaXN0Q291bnQ7IGkrKykge1xuICAgICAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbGlzdF9wcmVzZW50X2ZsYWdbIGkgXVxuICAgICAgICAgICAgaWYgKGkgPCA2KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDE2KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHZhciBwaWNPcmRlckNudFR5cGUgPSB0aGlzLnJlYWRVRUcoKTtcblxuICAgIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDApIHtcbiAgICAgIHRoaXMucmVhZFVFRygpOyAvL2xvZzJfbWF4X3BpY19vcmRlcl9jbnRfbHNiX21pbnVzNFxuICAgIH0gZWxzZSBpZiAocGljT3JkZXJDbnRUeXBlID09PSAxKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkZWx0YV9waWNfb3JkZXJfYWx3YXlzX3plcm9fZmxhZ1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9ub25fcmVmX3BpY1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZvcihpID0gMDsgaSA8IG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZTsgaSsrKSB7XG4gICAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbWF4X251bV9yZWZfZnJhbWVzXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZ2Fwc19pbl9mcmFtZV9udW1fdmFsdWVfYWxsb3dlZF9mbGFnXG5cbiAgICBwaWNXaWR0aEluTWJzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuXG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG5cbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkaXJlY3RfOHg4X2luZmVyZW5jZV9mbGFnXG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBmcmFtZV9jcm9wcGluZ19mbGFnXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgcHJvZmlsZUlkYyA6IHByb2ZpbGVJZGMsXG4gICAgICBwcm9maWxlQ29tcGF0IDogcHJvZmlsZUNvbXBhdCxcbiAgICAgIGxldmVsSWRjIDogbGV2ZWxJZGMsXG4gICAgICB3aWR0aDogKChwaWNXaWR0aEluTWJzTWludXMxICsgMSkgKiAxNikgLSBmcmFtZUNyb3BMZWZ0T2Zmc2V0ICogMiAtIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ICogMixcbiAgICAgIGhlaWdodDogKCgyIC0gZnJhbWVNYnNPbmx5RmxhZykgKiAocGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSArIDEpICogMTYpIC0gKGZyYW1lQ3JvcFRvcE9mZnNldCAqIDIpIC0gKGZyYW1lQ3JvcEJvdHRvbU9mZnNldCAqIDIpXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIEEgc3RyZWFtLWJhc2VkIG1wMnRzIHRvIG1wNCBjb252ZXJ0ZXIuIFRoaXMgdXRpbGl0eSBpcyB1c2VkIHRvXG4gKiBkZWxpdmVyIG1wNHMgdG8gYSBTb3VyY2VCdWZmZXIgb24gcGxhdGZvcm1zIHRoYXQgc3VwcG9ydCBuYXRpdmVcbiAqIE1lZGlhIFNvdXJjZSBFeHRlbnNpb25zLlxuICovXG5cbiBpbXBvcnQgRXZlbnQgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV4cEdvbG9tYiAgICAgICBmcm9tICcuL2V4cC1nb2xvbWInO1xuLy8gaW1wb3J0IEhleCAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9oZXgnO1xuIGltcG9ydCBNUDQgICAgICAgICAgICAgZnJvbSAnLi4vcmVtdXgvbXA0LWdlbmVyYXRvcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4gaW1wb3J0IHtsb2dnZXJ9ICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCB7RXJyb3JUeXBlcyxFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBUU0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubGFzdENDID0gMDtcbiAgICB0aGlzLlBFU19USU1FU0NBTEU9OTAwMDA7XG4gICAgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I9NDtcbiAgICB0aGlzLk1QNF9USU1FU0NBTEU9dGhpcy5QRVNfVElNRVNDQUxFL3RoaXMuUEVTMk1QNFNDQUxFRkFDVE9SO1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5wbXRQYXJzZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9wbXRJZCA9IHRoaXMuX2F2Y0lkID0gdGhpcy5fYWFjSWQgPSAtMTtcbiAgICB0aGlzLl9hdmNUcmFjayA9IHt0eXBlIDogJ3ZpZGVvJywgc2VxdWVuY2VOdW1iZXIgOiAwfTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHt0eXBlIDogJ2F1ZGlvJywgc2VxdWVuY2VOdW1iZXIgOiAwfTtcbiAgICB0aGlzLl9hdmNTYW1wbGVzID0gW107XG4gICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSA9IDA7XG4gICAgdGhpcy5fYWFjU2FtcGxlcyA9IFtdO1xuICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGluc2VydERpc2NvbnRpbnVpdHkoKSB7XG4gICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9pbml0RFRTID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsYXVkaW9Db2RlYywgdmlkZW9Db2RlYyx0aW1lT2Zmc2V0LGNjLGxldmVsLGR1cmF0aW9uKSB7XG4gICAgdmFyIGF2Y0RhdGEsYWFjRGF0YSxzdGFydCxsZW4gPSBkYXRhLmxlbmd0aCxzdHQscGlkLGF0ZixvZmZzZXQ7XG4gICAgdGhpcy5hdWRpb0NvZGVjID0gYXVkaW9Db2RlYztcbiAgICB0aGlzLnZpZGVvQ29kZWMgPSB2aWRlb0NvZGVjO1xuICAgIHRoaXMudGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICBpZihjYyAhPT0gdGhpcy5sYXN0Q0MpIHtcbiAgICAgIGxvZ2dlci5sb2coYGRpc2NvbnRpbnVpdHkgZGV0ZWN0ZWRgKTtcbiAgICAgIHRoaXMuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICAgICAgdGhpcy5sYXN0Q0MgPSBjYztcbiAgICB9IGVsc2UgaWYobGV2ZWwgIT09IHRoaXMubGFzdExldmVsKSB7XG4gICAgICBsb2dnZXIubG9nKGBsZXZlbCBzd2l0Y2ggZGV0ZWN0ZWRgKTtcbiAgICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICAgIHRoaXMubGFzdExldmVsID0gbGV2ZWw7XG4gICAgfVxuICAgIHZhciBwbXRQYXJzZWQ9dGhpcy5wbXRQYXJzZWQsYXZjSWQ9dGhpcy5fYXZjSWQsYWFjSWQ9dGhpcy5fYWFjSWQ7XG5cbiAgICAvLyBsb29wIHRocm91Z2ggVFMgcGFja2V0c1xuICAgIGZvcihzdGFydCA9IDA7IHN0YXJ0IDwgbGVuIDsgc3RhcnQgKz0gMTg4KSB7XG4gICAgICBpZihkYXRhW3N0YXJ0XSA9PT0gMHg0Nykge1xuICAgICAgICBzdHQgPSAhIShkYXRhW3N0YXJ0KzFdICYgMHg0MCk7XG4gICAgICAgIC8vIHBpZCBpcyBhIDEzLWJpdCBmaWVsZCBzdGFydGluZyBhdCB0aGUgbGFzdCBiaXQgb2YgVFNbMV1cbiAgICAgICAgcGlkID0gKChkYXRhW3N0YXJ0KzFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0KzJdO1xuICAgICAgICBhdGYgPSAoZGF0YVtzdGFydCszXSAmIDB4MzApID4+IDQ7XG4gICAgICAgIC8vIGlmIGFuIGFkYXB0aW9uIGZpZWxkIGlzIHByZXNlbnQsIGl0cyBsZW5ndGggaXMgc3BlY2lmaWVkIGJ5IHRoZSBmaWZ0aCBieXRlIG9mIHRoZSBUUyBwYWNrZXQgaGVhZGVyLlxuICAgICAgICBpZihhdGYgPiAxKSB7XG4gICAgICAgICAgb2Zmc2V0ID0gc3RhcnQrNStkYXRhW3N0YXJ0KzRdO1xuICAgICAgICAgIC8vIGNvbnRpbnVlIGlmIHRoZXJlIGlzIG9ubHkgYWRhcHRhdGlvbiBmaWVsZFxuICAgICAgICAgIGlmKG9mZnNldCA9PT0gKHN0YXJ0KzE4OCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCs0O1xuICAgICAgICB9XG4gICAgICAgIGlmKHBtdFBhcnNlZCkge1xuICAgICAgICAgIGlmKHBpZCA9PT0gYXZjSWQpIHtcbiAgICAgICAgICAgIGlmKHN0dCkge1xuICAgICAgICAgICAgICBpZihhdmNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGF2Y0RhdGEgPSB7ZGF0YTogW10sc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhdmNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCxzdGFydCsxODgpKTtcbiAgICAgICAgICAgIGF2Y0RhdGEuc2l6ZSs9c3RhcnQrMTg4LW9mZnNldDtcbiAgICAgICAgICB9IGVsc2UgaWYocGlkID09PSBhYWNJZCkge1xuICAgICAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgICAgIGlmKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYWFjRGF0YSA9IHtkYXRhOiBbXSxzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFhY0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LHN0YXJ0KzE4OCkpO1xuICAgICAgICAgICAgYWFjRGF0YS5zaXplKz1zdGFydCsxODgtb2Zmc2V0O1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZihzdHQpIHtcbiAgICAgICAgICAgIG9mZnNldCArPSBkYXRhW29mZnNldF0gKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZihwaWQgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUEFUKGRhdGEsb2Zmc2V0KTtcbiAgICAgICAgICB9IGVsc2UgaWYocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQTVQoZGF0YSxvZmZzZXQpO1xuICAgICAgICAgICAgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQgPSB0cnVlO1xuICAgICAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNJZDtcbiAgICAgICAgICAgIGFhY0lkID0gdGhpcy5fYWFjSWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6ZmFsc2UsIHJlYXNvbiA6ICdUUyBwYWNrZXQgZGlkIG5vdCBzdGFydCB3aXRoIDB4NDcnfSk7XG4gICAgICB9XG4gICAgfVxuICAvLyBwYXJzZSBsYXN0IFBFUyBwYWNrZXRcbiAgICBpZihhdmNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgfVxuICAgIGlmKGFhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICB9XG4gIH1cblxuICBlbmQoKSB7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmKCF0aGlzLl9pbml0U2VnR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLl9nZW5lcmF0ZUluaXRTZWdtZW50KCk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQVZDIHNhbXBsZXM6JyArIHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKTtcbiAgICBpZih0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBVkNTYW1wbGVzKCk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQUFDIHNhbXBsZXM6JyArIHRoaXMuX2FhY1NhbXBsZXMubGVuZ3RoKTtcbiAgICBpZih0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBQUNTYW1wbGVzKCk7XG4gICAgfVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNFRCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VQQVQoZGF0YSxvZmZzZXQpIHtcbiAgICAvLyBza2lwIHRoZSBQU0kgaGVhZGVyIGFuZCBwYXJzZSB0aGUgZmlyc3QgUE1UIGVudHJ5XG4gICAgdGhpcy5fcG10SWQgID0gKGRhdGFbb2Zmc2V0KzEwXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCsxMV07XG4gICAgLy9sb2dnZXIubG9nKCdQTVQgUElEOicgICsgdGhpcy5fcG10SWQpO1xuICB9XG5cbiAgX3BhcnNlUE1UKGRhdGEsb2Zmc2V0KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsdGFibGVFbmQscHJvZ3JhbUluZm9MZW5ndGgscGlkO1xuICAgIHNlY3Rpb25MZW5ndGggPSAoZGF0YVtvZmZzZXQrMV0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQrMl07XG4gICAgdGFibGVFbmQgPSBvZmZzZXQgKyAzICsgc2VjdGlvbkxlbmd0aCAtIDQ7XG4gICAgLy8gdG8gZGV0ZXJtaW5lIHdoZXJlIHRoZSB0YWJsZSBpcywgd2UgaGF2ZSB0byBmaWd1cmUgb3V0IGhvd1xuICAgIC8vIGxvbmcgdGhlIHByb2dyYW0gaW5mbyBkZXNjcmlwdG9ycyBhcmVcbiAgICBwcm9ncmFtSW5mb0xlbmd0aCA9IChkYXRhW29mZnNldCsxMF0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQrMTFdO1xuXG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCArPSAxMiArIHByb2dyYW1JbmZvTGVuZ3RoO1xuICAgIHdoaWxlIChvZmZzZXQgPCB0YWJsZUVuZCkge1xuICAgICAgcGlkID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgIHN3aXRjaChkYXRhW29mZnNldF0pIHtcbiAgICAgICAgLy8gSVNPL0lFQyAxMzgxOC03IEFEVFMgQUFDIChNUEVHLTIgbG93ZXIgYml0LXJhdGUgYXVkaW8pXG4gICAgICAgIGNhc2UgMHgwZjpcbiAgICAgICAgLy9sb2dnZXIubG9nKCdBQUMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hYWNJZCA9IHBpZDtcbiAgICAgICAgICB0aGlzLl9hYWNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vIElUVS1UIFJlYy4gSC4yNjQgYW5kIElTTy9JRUMgMTQ0OTYtMTAgKGxvd2VyIGJpdC1yYXRlIHZpZGVvKVxuICAgICAgICBjYXNlIDB4MWI6XG4gICAgICAgIC8vbG9nZ2VyLmxvZygnQVZDIFBJRDonICArIHBpZCk7XG4gICAgICAgIHRoaXMuX2F2Y0lkID0gcGlkO1xuICAgICAgICB0aGlzLl9hdmNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxvZ2dlci5sb2coJ3Vua293biBzdHJlYW0gdHlwZTonICArIGRhdGFbb2Zmc2V0XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSB0byB0aGUgbmV4dCB0YWJsZSBlbnRyeVxuICAgICAgLy8gc2tpcCBwYXN0IHRoZSBlbGVtZW50YXJ5IHN0cmVhbSBkZXNjcmlwdG9ycywgaWYgcHJlc2VudFxuICAgICAgb2Zmc2V0ICs9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MEYpIDw8IDggfCBkYXRhW29mZnNldCArIDRdKSArIDU7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEVTKHN0cmVhbSkge1xuICAgIHZhciBpID0gMCxmcmFnLHBlc0ZsYWdzLHBlc1ByZWZpeCxwZXNMZW4scGVzSGRyTGVuLHBlc0RhdGEscGVzUHRzLHBlc0R0cyxwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgLy9yZXRyaWV2ZSBQVFMvRFRTIGZyb20gZmlyc3QgZnJhZ21lbnRcbiAgICBmcmFnID0gc3RyZWFtLmRhdGFbMF07XG4gICAgcGVzUHJlZml4ID0gKGZyYWdbMF0gPDwgMTYpICsgKGZyYWdbMV0gPDwgOCkgKyBmcmFnWzJdO1xuICAgIGlmKHBlc1ByZWZpeCA9PT0gMSkge1xuICAgICAgcGVzTGVuID0gKGZyYWdbNF0gPDwgOCkgKyBmcmFnWzVdO1xuICAgICAgcGVzRmxhZ3MgPSBmcmFnWzddO1xuICAgICAgaWYgKHBlc0ZsYWdzICYgMHhDMCkge1xuICAgICAgICAvKiBQRVMgaGVhZGVyIGRlc2NyaWJlZCBoZXJlIDogaHR0cDovL2R2ZC5zb3VyY2Vmb3JnZS5uZXQvZHZkaW5mby9wZXMtaGRyLmh0bWxcbiAgICAgICAgICAgIGFzIFBUUyAvIERUUyBpcyAzMyBiaXQgd2UgY2Fubm90IHVzZSBiaXR3aXNlIG9wZXJhdG9yIGluIEpTLFxuICAgICAgICAgICAgYXMgQml0d2lzZSBvcGVyYXRvcnMgdHJlYXQgdGhlaXIgb3BlcmFuZHMgYXMgYSBzZXF1ZW5jZSBvZiAzMiBiaXRzICovXG4gICAgICAgIHBlc1B0cyA9IChmcmFnWzldICYgMHgwRSkqNTM2ODcwOTEyICsvLyAxIDw8IDI5XG4gICAgICAgICAgKGZyYWdbMTBdICYgMHhGRikqNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgIChmcmFnWzExXSAmIDB4RkUpKjE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgKGZyYWdbMTJdICYgMHhGRikqMTI4ICsvLyAxIDw8IDdcbiAgICAgICAgICAoZnJhZ1sxM10gJiAweEZFKS8yO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc1B0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgICAgLy8gZGVjcmVtZW50IDJeMzNcbiAgICAgICAgICAgICAgcGVzUHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICBpZiAocGVzRmxhZ3MgJiAweDQwKSB7XG4gICAgICAgICAgcGVzRHRzID0gKGZyYWdbMTRdICYgMHgwRSApKjUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgICAgKGZyYWdbMTVdICYgMHhGRiApKjQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAgIChmcmFnWzE2XSAmIDB4RkUgKSoxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgICAgKGZyYWdbMTddICYgMHhGRiApKjEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgICAoZnJhZ1sxOF0gJiAweEZFICkvMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNEdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICAgIHBlc0R0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZXNEdHMgPSBwZXNQdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlc0hkckxlbiA9IGZyYWdbOF07XG4gICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSBwZXNIZHJMZW4rOTtcbiAgICAgIC8vIHRyaW0gUEVTIGhlYWRlclxuICAgICAgc3RyZWFtLmRhdGFbMF0gPSBzdHJlYW0uZGF0YVswXS5zdWJhcnJheShwYXlsb2FkU3RhcnRPZmZzZXQpO1xuICAgICAgc3RyZWFtLnNpemUgLT0gcGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgICAgLy9yZWFzc2VtYmxlIFBFUyBwYWNrZXRcbiAgICAgIHBlc0RhdGEgPSBuZXcgVWludDhBcnJheShzdHJlYW0uc2l6ZSk7XG4gICAgICAvLyByZWFzc2VtYmxlIHRoZSBwYWNrZXRcbiAgICAgIHdoaWxlIChzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgZnJhZyA9IHN0cmVhbS5kYXRhLnNoaWZ0KCk7XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpICs9IGZyYWcuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IGRhdGEgOiBwZXNEYXRhLCBwdHMgOiBwZXNQdHMsIGR0cyA6IHBlc0R0cywgbGVuIDogcGVzTGVufTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlQVZDUEVTKHBlcykge1xuICAgIHZhciB1bml0cyx0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLGF2Y1NhbXBsZSxrZXkgPSBmYWxzZTtcbiAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSk7XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdW5pdHMudW5pdHMuZm9yRWFjaCh1bml0ID0+IHtcbiAgICAgIHN3aXRjaCh1bml0LnR5cGUpIHtcbiAgICAgICAgLy9JRFJcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgIGtleSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU1BTXG4gICAgICAgIGNhc2UgNzpcbiAgICAgICAgICBpZighdHJhY2suc3BzKSB7XG4gICAgICAgICAgICB2YXIgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcbiAgICAgICAgICAgIHZhciBjb25maWcgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRTUFMoKTtcbiAgICAgICAgICAgIHRyYWNrLndpZHRoID0gY29uZmlnLndpZHRoO1xuICAgICAgICAgICAgdHJhY2suaGVpZ2h0ID0gY29uZmlnLmhlaWdodDtcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVJZGMgPSBjb25maWcucHJvZmlsZUlkYztcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXQgPSBjb25maWcucHJvZmlsZUNvbXBhdDtcbiAgICAgICAgICAgIHRyYWNrLmxldmVsSWRjID0gY29uZmlnLmxldmVsSWRjO1xuICAgICAgICAgICAgdHJhY2suc3BzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgICB0cmFjay50aW1lc2NhbGUgPSB0aGlzLk1QNF9USU1FU0NBTEU7XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMuTVA0X1RJTUVTQ0FMRSp0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgICAgIHZhciBjb2RlY2FycmF5ID0gdW5pdC5kYXRhLnN1YmFycmF5KDEsNCk7XG4gICAgICAgICAgICB2YXIgY29kZWNzdHJpbmcgID0gJ2F2YzEuJztcbiAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICAgIGlmIChoLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGVjc3RyaW5nICs9IGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFjay5jb2RlYyA9IGNvZGVjc3RyaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9QUFNcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgIGlmKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvL2J1aWxkIHNhbXBsZSBmcm9tIFBFU1xuICAgIC8vIEFubmV4IEIgdG8gTVA0IGNvbnZlcnNpb24gdG8gYmUgZG9uZVxuICAgIGF2Y1NhbXBsZSA9IHsgdW5pdHMgOiB1bml0cywgcHRzIDogcGVzLnB0cywgZHRzIDogcGVzLmR0cyAsIGtleSA6IGtleX07XG4gICAgdGhpcy5fYXZjU2FtcGxlcy5wdXNoKGF2Y1NhbXBsZSk7XG4gICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCArPSB1bml0cy5sZW5ndGg7XG4gICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSArPSB1bml0cy51bml0cy5sZW5ndGg7XG4gIH1cblxuXG4gIF9mbHVzaEFWQ1NhbXBsZXMoKSB7XG4gICAgdmFyIHZpZXcsaT04LGF2Y1NhbXBsZSxtcDRTYW1wbGUsbXA0U2FtcGxlTGVuZ3RoLHVuaXQsdHJhY2sgPSB0aGlzLl9hdmNUcmFjayxcbiAgICAgICAgbGFzdFNhbXBsZURUUyxtZGF0LG1vb2YsZmlyc3RQVFMsZmlyc3REVFMscHRzLGR0cyxwdHNub3JtLGR0c25vcm0sc2FtcGxlcyA9IFtdO1xuXG4gICAgLyogY29uY2F0ZW5hdGUgdGhlIHZpZGVvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtcGRhdCB0eXBlKSAqL1xuICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoICsgKDQgKiB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1KSs4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsNCk7XG4gICAgd2hpbGUodGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGF2Y1NhbXBsZSA9IHRoaXMuX2F2Y1NhbXBsZXMuc2hpZnQoKTtcbiAgICAgIG1wNFNhbXBsZUxlbmd0aCA9IDA7XG5cbiAgICAgIC8vIGNvbnZlcnQgTkFMVSBiaXRzdHJlYW0gdG8gTVA0IGZvcm1hdCAocHJlcGVuZCBOQUxVIHdpdGggc2l6ZSBmaWVsZClcbiAgICAgIHdoaWxlKGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgpIHtcbiAgICAgICAgdW5pdCA9IGF2Y1NhbXBsZS51bml0cy51bml0cy5zaGlmdCgpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMihpLCB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIGkgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBpKTtcbiAgICAgICAgaSArPSB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoKz00K3VuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgICAgcHRzID0gYXZjU2FtcGxlLnB0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICBkdHMgPSBhdmNTYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIC8vbG9nZ2VyLmxvZygnVmlkZW8vUFRTL0RUUzonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMpO1xuXG4gICAgICBpZihsYXN0U2FtcGxlRFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsbGFzdFNhbXBsZURUUyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLGxhc3RTYW1wbGVEVFMpO1xuXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdFNhbXBsZURUUykvdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gICAgICAgIGlmKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsdGhpcy5uZXh0QXZjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsdGhpcy5uZXh0QXZjUHRzKTtcbiAgICAgICAgLy8gY2hlY2sgaWYgZnJhZ21lbnRzIGFyZSBjb250aWd1b3VzIChpLmUuIG5vIG1pc3NpbmcgZnJhbWVzIGJldHdlZW4gZnJhZ21lbnQpXG4gICAgICAgIGlmKHRoaXMubmV4dEF2Y1B0cykge1xuICAgICAgICAgIHZhciBkZWx0YSA9IE1hdGgucm91bmQoKHB0c25vcm0gLSB0aGlzLm5leHRBdmNQdHMpLzkwKSxhYnNkZWx0YT1NYXRoLmFicyhkZWx0YSk7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYnNkZWx0YS9hdmNTYW1wbGUucHRzOicgKyBhYnNkZWx0YSArICcvJyArIGF2Y1NhbXBsZS5wdHMpO1xuICAgICAgICAgIC8vIGlmIGRlbHRhIGlzIGxlc3MgdGhhbiAzMDAgbXMsIG5leHQgbG9hZGVkIGZyYWdtZW50IGlzIGFzc3VtZWQgdG8gYmUgY29udGlndW91cyB3aXRoIGxhc3Qgb25lXG4gICAgICAgICAgaWYoYWJzZGVsdGEgPCAzMDApIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnVmlkZW8gbmV4dCBQVFM6JyArIHRoaXMubmV4dEF2Y1B0cyk7XG4gICAgICAgICAgICBpZihkZWx0YSA+IDEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7ZGVsdGF9IG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzokeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IFBUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IHRoaXMubmV4dEF2Y1B0cztcbiAgICAgICAgICAgIC8vIG9mZnNldCBEVFMgYXMgd2VsbCwgZW5zdXJlIHRoYXQgRFRTIGlzIHNtYWxsZXIgb3IgZXF1YWwgdGhhbiBuZXcgUFRTXG4gICAgICAgICAgICBkdHNub3JtID0gTWF0aC5tYXgoZHRzbm9ybS1kZWx0YSwgdGhpcy5sYXN0QXZjRHRzKTtcbiAgICAgICAgICAgLy8gbG9nZ2VyLmxvZygnVmlkZW8vUFRTL0RUUyBhZGp1c3RlZDonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vdCBjb250aWd1b3VzIHRpbWVzdGFtcCwgY2hlY2sgaWYgUFRTIGlzIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgICAgICB2YXIgZXhwZWN0ZWRQVFMgPSB0aGlzLlBFU19USU1FU0NBTEUqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYW55IHVuZXhwZWN0ZWQgZHJpZnQgYmV0d2VlbiBleHBlY3RlZCB0aW1lc3RhbXAgYW5kIHJlYWwgb25lXG4gICAgICAgICAgICBpZihNYXRoLmFicyhleHBlY3RlZFBUUyAtIHB0c25vcm0pID4gdGhpcy5QRVNfVElNRVNDQUxFKjM2MDAgKSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgUFRTIGxvb3BpbmcgPz8/IEFWQyBQVFMgZGVsdGE6JHtleHBlY3RlZFBUUy1wdHNub3JtfWApO1xuICAgICAgICAgICAgICB2YXIgcHRzT2Zmc2V0ID0gZXhwZWN0ZWRQVFMtcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IGV4cGVjdGVkIFBUUztcbiAgICAgICAgICAgICAgcHRzbm9ybSA9IGV4cGVjdGVkUFRTO1xuICAgICAgICAgICAgICBkdHNub3JtID0gcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gb2Zmc2V0IGluaXRQVFMvaW5pdERUUyB0byBmaXggY29tcHV0YXRpb24gZm9yIGZvbGxvd2luZyBzYW1wbGVzXG4gICAgICAgICAgICAgIHRoaXMuX2luaXRQVFMtPXB0c09mZnNldDtcbiAgICAgICAgICAgICAgdGhpcy5faW5pdERUUy09cHRzT2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGF2Y1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAscHRzbm9ybSk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCxkdHNub3JtKTtcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2coYFBUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthdmNTYW1wbGUucHRzfS8ke2F2Y1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGF2Y1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX1gKTtcblxuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgIGR1cmF0aW9uIDogMCxcbiAgICAgICAgY3RzOiAocHRzbm9ybSAtIGR0c25vcm0pL3RoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRQcmlvOiAwXG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGlmKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMTtcbiAgICAgIH1cbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdFNhbXBsZURUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIGlmKHNhbXBsZXMubGVuZ3RoID49Mikge1xuICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gc2FtcGxlc1tzYW1wbGVzLmxlbmd0aC0yXS5kdXJhdGlvbjtcbiAgICB9XG4gICAgdGhpcy5sYXN0QXZjRHRzID0gZHRzbm9ybTtcbiAgICAvLyBuZXh0IEFWQyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgIHRoaXMubmV4dEF2Y1B0cyA9IHB0c25vcm0gKyBtcDRTYW1wbGUuZHVyYXRpb24qdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gICAgLy9sb2dnZXIubG9nKCdWaWRlby9sYXN0QXZjRHRzL25leHRBdmNQdHM6JyArIHRoaXMubGFzdEF2Y0R0cyArICcvJyArIHRoaXMubmV4dEF2Y1B0cyk7XG5cbiAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1ID0gMDtcblxuICAgIHRyYWNrLnNhbXBsZXMgPSBzYW1wbGVzO1xuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLGZpcnN0RFRTL3RoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICBtb29mOiBtb29mLFxuICAgICAgbWRhdDogbWRhdCxcbiAgICAgIHN0YXJ0UFRTIDogZmlyc3RQVFMvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgZW5kUFRTIDogdGhpcy5uZXh0QXZjUHRzL3RoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIHN0YXJ0RFRTIDogZmlyc3REVFMvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgZW5kRFRTIDogKGR0c25vcm0gKyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUiptcDRTYW1wbGUuZHVyYXRpb24pL3RoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgIHR5cGUgOiAndmlkZW8nLFxuICAgICAgbmIgOiBzYW1wbGVzLmxlbmd0aFxuICAgIH0pO1xuICB9XG5cbiAgX3BhcnNlQVZDTkFMdShhcnJheSkge1xuICAgIHZhciBpID0gMCxsZW4gPSBhcnJheS5ieXRlTGVuZ3RoLHZhbHVlLG92ZXJmbG93LHN0YXRlID0gMDtcbiAgICB2YXIgdW5pdHMgPSBbXSwgdW5pdCwgdW5pdFR5cGUsIGxhc3RVbml0U3RhcnQsbGFzdFVuaXRUeXBlLGxlbmd0aCA9IDA7XG4gICAgLy9sb2dnZXIubG9nKCdQRVM6JyArIEhleC5oZXhEdW1wKGFycmF5KSk7XG5cbiAgICB3aGlsZShpPCBsZW4pIHtcbiAgICAgIHZhbHVlID0gYXJyYXlbaSsrXTtcbiAgICAgIC8vIGZpbmRpbmcgMyBvciA0LWJ5dGUgc3RhcnQgY29kZXMgKDAwIDAwIDAxIE9SIDAwIDAwIDAwIDAxKVxuICAgICAgc3dpdGNoKHN0YXRlKSB7XG4gICAgICAgIGNhc2UgMDpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIGlmKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmKHZhbHVlID09PSAxKSB7XG4gICAgICAgICAgICB1bml0VHlwZSA9IGFycmF5W2ldICYgMHgxZjtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBOQUxVIEAgb2Zmc2V0OicgKyBpICsgJyx0eXBlOicgKyB1bml0VHlwZSk7XG4gICAgICAgICAgICBpZihsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICAgICAgICAgIHVuaXQgPSB7IGRhdGEgOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LGktc3RhdGUtMSksIHR5cGUgOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgICAgICAgICBsZW5ndGgrPWktc3RhdGUtMS1sYXN0VW5pdFN0YXJ0O1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiBOQUwgdW5pdHMgYXJlIG5vdCBzdGFydGluZyByaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGFja2V0LCBwdXNoIHByZWNlZGluZyBkYXRhIGludG8gcHJldmlvdXMgTkFMIHVuaXQuXG4gICAgICAgICAgICAgIG92ZXJmbG93ICA9IGkgLSBzdGF0ZSAtIDE7XG4gICAgICAgICAgICAgIGlmIChvdmVyZmxvdykge1xuICAgICAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaXJzdCBOQUxVIGZvdW5kIHdpdGggb3ZlcmZsb3c6JyArIG92ZXJmbG93KTtcbiAgICAgICAgICAgICAgICAgIGlmKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBsYXN0YXZjU2FtcGxlID0gdGhpcy5fYXZjU2FtcGxlc1t0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aC0xXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxhc3RVbml0ID0gbGFzdGF2Y1NhbXBsZS51bml0cy51bml0c1tsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLmxlbmd0aC0xXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCtvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICAgIHRtcC5zZXQobGFzdFVuaXQuZGF0YSwwKTtcbiAgICAgICAgICAgICAgICAgICAgdG1wLnNldChhcnJheS5zdWJhcnJheSgwLG92ZXJmbG93KSxsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgICAgICAgICAgICAgICBsYXN0YXZjU2FtcGxlLnVuaXRzLmxlbmd0aCs9b3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGgrPW92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0VW5pdFN0YXJ0ID0gaTtcbiAgICAgICAgICAgIGxhc3RVbml0VHlwZSA9IHVuaXRUeXBlO1xuICAgICAgICAgICAgaWYodW5pdFR5cGUgPT09IDEgfHwgdW5pdFR5cGUgPT09IDUpIHtcbiAgICAgICAgICAgICAgLy8gT1BUSSAhISEgaWYgSURSL05EUiB1bml0LCBjb25zaWRlciBpdCBpcyBsYXN0IE5BTHVcbiAgICAgICAgICAgICAgaSA9IGxlbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHsgZGF0YSA6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsbGVuKSwgdHlwZSA6IGxhc3RVbml0VHlwZX07XG4gICAgICBsZW5ndGgrPWxlbi1sYXN0VW5pdFN0YXJ0O1xuICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgdW5pdHMgOiB1bml0cyAsIGxlbmd0aCA6IGxlbmd0aH07XG4gIH1cblxuICBfUFRTTm9ybWFsaXplKHZhbHVlLHJlZmVyZW5jZSkge1xuICAgIHZhciBvZmZzZXQ7XG4gICAgaWYgKHJlZmVyZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChyZWZlcmVuY2UgPCB2YWx1ZSkge1xuICAgICAgICAvLyAtIDJeMzNcbiAgICAgICAgb2Zmc2V0ID0gLTg1ODk5MzQ1OTI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gKyAyXjMzXG4gICAgICAgIG9mZnNldCA9IDg1ODk5MzQ1OTI7XG4gICAgfVxuICAgIC8qIFBUUyBpcyAzM2JpdCAoZnJvbSAwIHRvIDJeMzMgLTEpXG4gICAgICBpZiBkaWZmIGJldHdlZW4gdmFsdWUgYW5kIHJlZmVyZW5jZSBpcyBiaWdnZXIgdGhhbiBoYWxmIG9mIHRoZSBhbXBsaXR1ZGUgKDJeMzIpIHRoZW4gaXQgbWVhbnMgdGhhdFxuICAgICAgUFRTIGxvb3Bpbmcgb2NjdXJlZC4gZmlsbCB0aGUgZ2FwICovXG4gICAgd2hpbGUgKE1hdGguYWJzKHZhbHVlIC0gcmVmZXJlbmNlKSA+IDQyOTQ5NjcyOTYpIHtcbiAgICAgICAgdmFsdWUgKz0gb2Zmc2V0O1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICBfcGFyc2VBQUNQRVMocGVzKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssYWFjU2FtcGxlLGRhdGEgPSBwZXMuZGF0YSxjb25maWcsYWR0c0ZyYW1lU2l6ZSxhZHRzU3RhcnRPZmZzZXQsYWR0c0hlYWRlckxlbixzdGFtcCxuYlNhbXBsZXMsbGVuO1xuICAgIGlmKHRoaXMuYWFjT3ZlckZsb3cpIHtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheSh0aGlzLmFhY092ZXJGbG93LmJ5dGVMZW5ndGgrZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQodGhpcy5hYWNPdmVyRmxvdywwKTtcbiAgICAgIHRtcC5zZXQoZGF0YSx0aGlzLmFhY092ZXJGbG93LmJ5dGVMZW5ndGgpO1xuICAgICAgZGF0YSA9IHRtcDtcbiAgICB9XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IoYWR0c1N0YXJ0T2Zmc2V0ID0gMCwgbGVuID0gZGF0YS5sZW5ndGg7IGFkdHNTdGFydE9mZnNldDxsZW4tMTsgYWR0c1N0YXJ0T2Zmc2V0KyspIHtcbiAgICAgIGlmKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW2FkdHNTdGFydE9mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmKGFkdHNTdGFydE9mZnNldCkge1xuICAgICAgdmFyIHJlYXNvbixmYXRhbDtcbiAgICAgIGlmKGFkdHNTdGFydE9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke2FkdHNTdGFydE9mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gYG5vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVNgO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6ZmF0YWwsIHJlYXNvbiA6IHJlYXNvbn0pO1xuICAgICAgaWYoZmF0YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgIGNvbmZpZyA9IHRoaXMuX0FEVFN0b0F1ZGlvQ29uZmlnKGRhdGEsYWR0c1N0YXJ0T2Zmc2V0LHRoaXMuYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay50aW1lc2NhbGUgPSB0aGlzLk1QNF9USU1FU0NBTEU7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMuTVA0X1RJTUVTQ0FMRSp0aGlzLl9kdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCAgIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIG5iU2FtcGxlcyA9IDA7XG4gICAgd2hpbGUoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgbGVuKSB7XG4gICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCszXSAmIDB4MDMpIDw8IDExKTtcbiAgICAgIC8vIGJ5dGUgNFxuICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoZGF0YVthZHRzU3RhcnRPZmZzZXQrNF0gPDwgMyk7XG4gICAgICAvLyBieXRlIDVcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKChkYXRhW2FkdHNTdGFydE9mZnNldCs1XSAmIDB4RTApID4+PiA1KTtcbiAgICAgIGFkdHNIZWFkZXJMZW4gPSAoISEoZGF0YVthZHRzU3RhcnRPZmZzZXQrMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIGFkdHNGcmFtZVNpemUgLT0gYWR0c0hlYWRlckxlbjtcbiAgICAgIHN0YW1wID0gTWF0aC5yb3VuZChwZXMucHRzICsgbmJTYW1wbGVzKjEwMjQqdGhpcy5QRVNfVElNRVNDQUxFL3RyYWNrLmF1ZGlvc2FtcGxlcmF0ZSk7XG4gICAgICAvL3N0YW1wID0gcGVzLnB0cztcbiAgICAgIC8vY29uc29sZS5sb2coJ0FBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC9wdHM6JyArIChhZHRzU3RhcnRPZmZzZXQrNykgKyAnLycgKyBhZHRzRnJhbWVTaXplICsgJy8nICsgc3RhbXAudG9GaXhlZCgwKSk7XG4gICAgICBpZihhZHRzU3RhcnRPZmZzZXQrYWR0c0hlYWRlckxlbithZHRzRnJhbWVTaXplIDw9IGxlbikge1xuICAgICAgICBhYWNTYW1wbGUgPSB7IHVuaXQgOiBkYXRhLnN1YmFycmF5KGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuLGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuK2FkdHNGcmFtZVNpemUpICwgcHRzIDogc3RhbXAsIGR0cyA6IHN0YW1wfTtcbiAgICAgICAgdGhpcy5fYWFjU2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggKz0gYWR0c0ZyYW1lU2l6ZTtcbiAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0Kz1hZHRzRnJhbWVTaXplK2FkdHNIZWFkZXJMZW47XG4gICAgICAgIG5iU2FtcGxlcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGFkdHNTdGFydE9mZnNldCA8IGxlbikge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0LGxlbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9mbHVzaEFBQ1NhbXBsZXMoKSB7XG4gICAgdmFyIHZpZXcsaT04LGFhY1NhbXBsZSxtcDRTYW1wbGUsdW5pdCx0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBsYXN0U2FtcGxlRFRTLG1kYXQsbW9vZixmaXJzdFBUUyxmaXJzdERUUyxwdHMsZHRzLHB0c25vcm0sZHRzbm9ybSxzYW1wbGVzID0gW107XG5cbiAgICAvKiBjb25jYXRlbmF0ZSB0aGUgYXVkaW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1wZGF0IHR5cGUpICovXG4gICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRoaXMuX2FhY1NhbXBsZXNMZW5ndGgrOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCxtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LDQpO1xuICAgIHdoaWxlKHRoaXMuX2FhY1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhYWNTYW1wbGUgPSB0aGlzLl9hYWNTYW1wbGVzLnNoaWZ0KCk7XG4gICAgICB1bml0ID0gYWFjU2FtcGxlLnVuaXQ7XG4gICAgICBtZGF0LnNldCh1bml0LCBpKTtcbiAgICAgIGkgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuXG4gICAgICBwdHMgPSBhYWNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGFhY1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuXG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUzonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApKTtcbiAgICAgIGlmKGxhc3RTYW1wbGVEVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cyxsYXN0U2FtcGxlRFRTKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsbGFzdFNhbXBsZURUUyk7XG4gICAgICAgIC8vIHdlIHVzZSBEVFMgdG8gY29tcHV0ZSBzYW1wbGUgZHVyYXRpb24sIGJ1dCB3ZSB1c2UgUFRTIHRvIGNvbXB1dGUgaW5pdFBUUyB3aGljaCBpcyB1c2VkIHRvIHN5bmMgYXVkaW8gYW5kIHZpZGVvXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdFNhbXBsZURUUykvdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gICAgICAgIGlmKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsdGhpcy5uZXh0QWFjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsdGhpcy5uZXh0QWFjUHRzKTtcbiAgICAgICAgLy8gY2hlY2sgaWYgZnJhZ21lbnRzIGFyZSBjb250aWd1b3VzIChpLmUuIG5vIG1pc3NpbmcgZnJhbWVzIGJldHdlZW4gZnJhZ21lbnQpXG4gICAgICAgIGlmKHRoaXMubmV4dEFhY1B0cyAmJiB0aGlzLm5leHRBYWNQdHMgIT09IHB0c25vcm0pIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvIG5leHQgUFRTOicgKyB0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICAgIHZhciBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCoocHRzbm9ybSAtIHRoaXMubmV4dEFhY1B0cykvdGhpcy5QRVNfVElNRVNDQUxFKSxhYnNkZWx0YT1NYXRoLmFicyhkZWx0YSk7XG4gICAgICAgICAgLy8gaWYgZGVsdGEgaXMgbGVzcyB0aGFuIDMwMCBtcywgbmV4dCBsb2FkZWQgZnJhZ21lbnQgaXMgYXNzdW1lZCB0byBiZSBjb250aWd1b3VzIHdpdGggbGFzdCBvbmVcbiAgICAgICAgICBpZihhYnNkZWx0YSA+IDEgJiYgYWJzZGVsdGEgPCAzMDApIHtcbiAgICAgICAgICAgIGlmKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBQUM6JHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4gICAgICAgICAgICAgIC8vIHNldCBQVFMgdG8gbmV4dCBQVFMsIGFuZCBlbnN1cmUgUFRTIGlzIGdyZWF0ZXIgb3IgZXF1YWwgdGhhbiBsYXN0IERUU1xuICAgICAgICAgICAgICBwdHNub3JtID0gTWF0aC5tYXgodGhpcy5uZXh0QWFjUHRzLCB0aGlzLmxhc3RBYWNEdHMpO1xuICAgICAgICAgICAgICBkdHNub3JtID0gcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvRFRTIGFkanVzdGVkOicgKyBhYWNTYW1wbGUucHRzICsgJy8nICsgYWFjU2FtcGxlLmR0cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBQUM6JHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAoYWJzZGVsdGEpIHtcbiAgICAgICAgICAgIC8vIG5vdCBjb250aWd1b3VzIHRpbWVzdGFtcCwgY2hlY2sgaWYgUFRTIGlzIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgICAgICB2YXIgZXhwZWN0ZWRQVFMgPSB0aGlzLlBFU19USU1FU0NBTEUqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBleHBlY3RlZFBUUy9QVFNub3JtOiR7ZXhwZWN0ZWRQVFN9LyR7cHRzbm9ybX0vJHtleHBlY3RlZFBUUy1wdHNub3JtfWApO1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYW55IHVuZXhwZWN0ZWQgZHJpZnQgYmV0d2VlbiBleHBlY3RlZCB0aW1lc3RhbXAgYW5kIHJlYWwgb25lXG4gICAgICAgICAgICBpZihNYXRoLmFicyhleHBlY3RlZFBUUyAtIHB0c25vcm0pID4gdGhpcy5QRVNfVElNRVNDQUxFKjM2MDAgKSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgUFRTIGxvb3BpbmcgPz8/IEFBQyBQVFMgZGVsdGE6JHtleHBlY3RlZFBUUy1wdHNub3JtfWApO1xuICAgICAgICAgICAgICB2YXIgcHRzT2Zmc2V0ID0gZXhwZWN0ZWRQVFMtcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IGV4cGVjdGVkIFBUUztcbiAgICAgICAgICAgICAgcHRzbm9ybSA9IGV4cGVjdGVkUFRTO1xuICAgICAgICAgICAgICBkdHNub3JtID0gcHRzbm9ybTtcbiAgICAgICAgICAgICAgLy8gb2Zmc2V0IGluaXRQVFMvaW5pdERUUyB0byBmaXggY29tcHV0YXRpb24gZm9yIGZvbGxvd2luZyBzYW1wbGVzXG4gICAgICAgICAgICAgIHRoaXMuX2luaXRQVFMtPXB0c09mZnNldDtcbiAgICAgICAgICAgICAgdGhpcy5faW5pdERUUy09cHRzT2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGFhY1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAscHRzbm9ybSk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCxkdHNub3JtKTtcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2coYFBUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthYWNTYW1wbGUucHRzfS8ke2FhY1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGFhY1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX1gKTtcbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogdW5pdC5ieXRlTGVuZ3RoLFxuICAgICAgICBjdHM6IDAsXG4gICAgICAgIGR1cmF0aW9uOjAsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uIDogMSxcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdFNhbXBsZURUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIC8vc2V0IGxhc3Qgc2FtcGxlIGR1cmF0aW9uIGFzIGJlaW5nIGlkZW50aWNhbCB0byBwcmV2aW91cyBzYW1wbGVcbiAgICBpZihzYW1wbGVzLmxlbmd0aCA+PTIpIHtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGgtMl0uZHVyYXRpb247XG4gICAgfVxuICAgIHRoaXMubGFzdEFhY0R0cyA9IGR0c25vcm07XG4gICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBYWNQdHMgPSBwdHNub3JtICsgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IqbXA0U2FtcGxlLmR1cmF0aW9uO1xuICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8vUFRTL1BUU2VuZDonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApICsgJy8nICsgdGhpcy5uZXh0QWFjRHRzLnRvRml4ZWQoMCkpO1xuXG4gICAgdGhpcy5fYWFjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssZmlyc3REVFMvdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsdHJhY2spO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFMgOiBmaXJzdFBUUy90aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICBlbmRQVFMgOiB0aGlzLm5leHRBYWNQdHMvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgc3RhcnREVFMgOiBmaXJzdERUUy90aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICBlbmREVFMgOiAoZHRzbm9ybSArIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SKm1wNFNhbXBsZS5kdXJhdGlvbikvdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgdHlwZSA6ICdhdWRpbycsXG4gICAgICBuYiA6IHNhbXBsZXMubGVuZ3RoXG4gICAgfSk7XG4gIH1cblxuICBfQURUU3RvQXVkaW9Db25maWcoZGF0YSxvZmZzZXQsYXVkaW9Db2RlYykge1xuICAgIHZhciBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNDaGFuZWxDb25maWcsIC8vIDppbnRcbiAgICAgICAgY29uZmlnLFxuICAgICAgICB1c2VyQWdlbnQgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGFkdHNTYW1wbGVpbmdSYXRlcyA9IFtcbiAgICAgICAgICAgIDk2MDAwLCA4ODIwMCxcbiAgICAgICAgICAgIDY0MDAwLCA0ODAwMCxcbiAgICAgICAgICAgIDQ0MTAwLCAzMjAwMCxcbiAgICAgICAgICAgIDI0MDAwLCAyMjA1MCxcbiAgICAgICAgICAgIDE2MDAwLCAxMjAwMFxuICAgICAgICAgIF07XG5cbiAgICAvLyBieXRlIDJcbiAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVtvZmZzZXQrMl0gJiAweEMwKSA+Pj4gNikgKyAxO1xuICAgIGFkdHNTYW1wbGVpbmdJbmRleCA9ICgoZGF0YVtvZmZzZXQrMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgYWR0c0NoYW5lbENvbmZpZyA9ICgoZGF0YVtvZmZzZXQrMl0gJiAweDAxKSA8PCAyKTtcbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVtvZmZzZXQrM10gJiAweEMwKSA+Pj4gNik7XG5cbiAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBjb2RlYzoke2F1ZGlvQ29kZWN9LEFEVFMgZGF0YTp0eXBlOiR7YWR0c09iamVjdFR5cGV9LHNhbXBsZWluZ0luZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fVske2FkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdfWtIel0sY2hhbm5lbENvbmZpZzoke2FkdHNDaGFuZWxDb25maWd9YCk7XG5cblxuICAgIC8vIGZpcmVmb3g6IGZyZXEgbGVzcyB0aGFuIDI0a0h6ID0gQUFDIFNCUiAoSEUtQUFDKVxuICAgIGlmKHVzZXJBZ2VudC5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xKSB7XG4gICAgICBpZihhZHRzU2FtcGxlaW5nSW5kZXggPj02KSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4LTM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgICAgLy8gQW5kcm9pZCA6IGFsd2F5cyB1c2UgQUFDXG4gICAgfSBlbHNlIGlmKHVzZXJBZ2VudC5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qICBmb3Igb3RoZXIgYnJvd3NlcnMgKGNocm9tZSAuLi4pXG4gICAgICAgICAgYWx3YXlzIGZvcmNlIGF1ZGlvIHR5cGUgdG8gYmUgSEUtQUFDIFNCUiwgYXMgc29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2ggcHJvcGVybHkgKGxpa2UgQ2hyb21lIC4uLilcbiAgICAgICovXG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBIRS1BQUMpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIEFORCBmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6KVxuICAgICAgaWYoKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkgfHwgKCFhdWRpb0NvZGVjICYmIGFkdHNTYW1wbGVpbmdJbmRleCA+PTYpKSAge1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgQUFDKSBBTkQgKGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHogT1IgbmIgY2hhbm5lbCBpcyAxKVxuICAgICAgICBpZihhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yJykgIT09LTEgJiYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2IHx8IGFkdHNDaGFuZWxDb25maWcgPT09MSkpIHtcbiAgICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICB9XG4gIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgIElTTyAxNDQ5Ni0zIChBQUMpLnBkZiAtIFRhYmxlIDEuMTMg4oCUIFN5bnRheCBvZiBBdWRpb1NwZWNpZmljQ29uZmlnKClcbiAgICBBdWRpbyBQcm9maWxlIC8gQXVkaW8gT2JqZWN0IFR5cGVcbiAgICAwOiBOdWxsXG4gICAgMTogQUFDIE1haW5cbiAgICAyOiBBQUMgTEMgKExvdyBDb21wbGV4aXR5KVxuICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgIDQ6IEFBQyBMVFAgKExvbmcgVGVybSBQcmVkaWN0aW9uKVxuICAgIDU6IFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbilcbiAgICA2OiBBQUMgU2NhbGFibGVcbiAgIHNhbXBsaW5nIGZyZXFcbiAgICAwOiA5NjAwMCBIelxuICAgIDE6IDg4MjAwIEh6XG4gICAgMjogNjQwMDAgSHpcbiAgICAzOiA0ODAwMCBIelxuICAgIDQ6IDQ0MTAwIEh6XG4gICAgNTogMzIwMDAgSHpcbiAgICA2OiAyNDAwMCBIelxuICAgIDc6IDIyMDUwIEh6XG4gICAgODogMTYwMDAgSHpcbiAgICA5OiAxMjAwMCBIelxuICAgIDEwOiAxMTAyNSBIelxuICAgIDExOiA4MDAwIEh6XG4gICAgMTI6IDczNTAgSHpcbiAgICAxMzogUmVzZXJ2ZWRcbiAgICAxNDogUmVzZXJ2ZWRcbiAgICAxNTogZnJlcXVlbmN5IGlzIHdyaXR0ZW4gZXhwbGljdGx5XG4gICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAwOiBEZWZpbmVkIGluIEFPVCBTcGVjaWZjIENvbmZpZ1xuICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgKi9cbiAgICAvLyBhdWRpb09iamVjdFR5cGUgPSBwcm9maWxlID0+IHByb2ZpbGUsIHRoZSBNUEVHLTQgQXVkaW8gT2JqZWN0IFR5cGUgbWludXMgMVxuICAgIGNvbmZpZ1swXSA9IGFkdHNPYmplY3RUeXBlIDw8IDM7XG4gICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgIGNvbmZpZ1swXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICBjb25maWdbMV0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICBjb25maWdbMV0gfD0gYWR0c0NoYW5lbENvbmZpZyA8PCAzO1xuICAgIGlmKGFkdHNPYmplY3RUeXBlID09PSA1KSB7XG4gICAgICAvLyBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXhcbiAgICAgIGNvbmZpZ1sxXSB8PSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICAgIGNvbmZpZ1syXSA9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgICAgLy8gYWR0c09iamVjdFR5cGUgKGZvcmNlIHRvIDIsIGNocm9tZSBpcyBjaGVja2luZyB0aGF0IG9iamVjdCB0eXBlIGlzIGxlc3MgdGhhbiA1ID8/P1xuICAgICAgLy8gICAgaHR0cHM6Ly9jaHJvbWl1bS5nb29nbGVzb3VyY2UuY29tL2Nocm9taXVtL3NyYy5naXQvKy9tYXN0ZXIvbWVkaWEvZm9ybWF0cy9tcDQvYWFjLmNjXG4gICAgICBjb25maWdbMl0gfD0gMiA8PCAyO1xuICAgICAgY29uZmlnWzNdID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIHsgY29uZmlnIDogY29uZmlnLCBzYW1wbGVyYXRlIDogYWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF0sIGNoYW5uZWxDb3VudCA6IGFkdHNDaGFuZWxDb25maWcsIGNvZGVjIDogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG5cbiAgX2dlbmVyYXRlSW5pdFNlZ21lbnQoKSB7XG4gICAgaWYodGhpcy5fYXZjSWQgPT09IC0xKSB7XG4gICAgICAvL2F1ZGlvIG9ubHlcbiAgICAgIGlmKHRoaXMuX2FhY1RyYWNrLmNvbmZpZykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULHtcbiAgICAgICAgICBhdWRpb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYWFjVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjIDogdGhpcy5fYWFjVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQgOiB0aGlzLl9hYWNUcmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzIC0gdGhpcy5QRVNfVElNRVNDQUxFKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzIC0gdGhpcy5QRVNfVElNRVNDQUxFKnRoaXMudGltZU9mZnNldDtcbiAgICAgIH1cbiAgICB9IGVsc2VcbiAgICBpZih0aGlzLl9hYWNJZCA9PT0gLTEpIHtcbiAgICAgIC8vdmlkZW8gb25seVxuICAgICAgaWYodGhpcy5fYXZjVHJhY2suc3BzICYmIHRoaXMuX2F2Y1RyYWNrLnBwcykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULHtcbiAgICAgICAgICB2aWRlb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYXZjVHJhY2tdKSxcbiAgICAgICAgICB2aWRlb0NvZGVjIDogdGhpcy5fYXZjVHJhY2suY29kZWMsXG4gICAgICAgICAgdmlkZW9XaWR0aCA6IHRoaXMuX2F2Y1RyYWNrLndpZHRoLFxuICAgICAgICAgIHZpZGVvSGVpZ2h0IDogdGhpcy5fYXZjVHJhY2suaGVpZ2h0XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgICAgaWYodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9hdmNTYW1wbGVzWzBdLnB0cyAtIHRoaXMuUEVTX1RJTUVTQ0FMRSp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2F2Y1NhbXBsZXNbMF0uZHRzIC0gdGhpcy5QRVNfVElNRVNDQUxFKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2F1ZGlvIGFuZCB2aWRlb1xuICAgICAgaWYodGhpcy5fYWFjVHJhY2suY29uZmlnICYmIHRoaXMuX2F2Y1RyYWNrLnNwcyAmJiB0aGlzLl9hdmNUcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IHRoaXMuX2FhY1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogdGhpcy5fYWFjVHJhY2suY2hhbm5lbENvdW50LFxuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IE1hdGgubWluKHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzLHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzKSAtIHRoaXMuUEVTX1RJTUVTQ0FMRSp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgdGhpcy5faW5pdERUUyA9IE1hdGgubWluKHRoaXMuX2F2Y1NhbXBsZXNbMF0uZHRzLHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzKSAtIHRoaXMuUEVTX1RJTUVTQ0FMRSp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVFNEZW11eGVyO1xuIiwiIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBUU0RlbXV4ZXIgICAgICAgICAgICBmcm9tICcuLi9kZW11eC90c2RlbXV4ZXInO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG5cbnZhciBUU0RlbXV4ZXJXb3JrZXIgPSBmdW5jdGlvbiAoc2VsZikge1xuICAgIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsZnVuY3Rpb24gKGV2KSB7XG4gICAgICAvL2NvbnNvbGUubG9nKCdkZW11eGVyIGNtZDonICsgZXYuZGF0YS5jbWQpO1xuICAgICAgc3dpdGNoKGV2LmRhdGEuY21kKSB7XG4gICAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZGVtdXgnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGV2LmRhdGEuZGF0YSksIGV2LmRhdGEuYXVkaW9Db2RlYyxldi5kYXRhLnZpZGVvQ29kZWMsIGV2LmRhdGEudGltZU9mZnNldCwgZXYuZGF0YS5jYywgZXYuZGF0YS5sZXZlbCwgZXYuZGF0YS5kdXJhdGlvbik7XG4gICAgICAgICAgc2VsZi5kZW11eGVyLmVuZCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gbGlzdGVuIHRvIGV2ZW50cyB0cmlnZ2VyZWQgYnkgVFMgRGVtdXhlclxuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIGZ1bmN0aW9uKGV2LGRhdGEpIHtcbiAgICAgIHZhciBvYmpEYXRhID0geyBldmVudCA6IGV2IH07XG4gICAgICB2YXIgb2JqVHJhbnNmZXJhYmxlID0gW107XG4gICAgICBpZihkYXRhLmF1ZGlvQ29kZWMpIHtcbiAgICAgICAgb2JqRGF0YS5hdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICBvYmpEYXRhLmF1ZGlvTW9vdiA9IGRhdGEuYXVkaW9Nb292LmJ1ZmZlcjtcbiAgICAgICAgb2JqRGF0YS5hdWRpb0NoYW5uZWxDb3VudCA9IGRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEuYXVkaW9Nb292KTtcbiAgICAgIH1cbiAgICAgIGlmKGRhdGEudmlkZW9Db2RlYykge1xuICAgICAgICBvYmpEYXRhLnZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgICAgIG9iakRhdGEudmlkZW9Nb292ID0gZGF0YS52aWRlb01vb3YuYnVmZmVyO1xuICAgICAgICBvYmpEYXRhLnZpZGVvV2lkdGggPSBkYXRhLnZpZGVvV2lkdGg7XG4gICAgICAgIG9iakRhdGEudmlkZW9IZWlnaHQgPSBkYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICBvYmpUcmFuc2ZlcmFibGUucHVzaChvYmpEYXRhLnZpZGVvTW9vdik7XG4gICAgICB9XG4gICAgICAvLyBwYXNzIG1vb3YgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSxvYmpUcmFuc2ZlcmFibGUpO1xuICAgIH0pO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCBmdW5jdGlvbihldixkYXRhKSB7XG4gICAgICB2YXIgb2JqRGF0YSA9IHsgZXZlbnQgOiBldiAsIHR5cGUgOiBkYXRhLnR5cGUsIHN0YXJ0UFRTIDogZGF0YS5zdGFydFBUUywgZW5kUFRTIDogZGF0YS5lbmRQVFMgLCBzdGFydERUUyA6IGRhdGEuc3RhcnREVFMsIGVuZERUUyA6IGRhdGEuZW5kRFRTICxtb29mIDogZGF0YS5tb29mLmJ1ZmZlciwgbWRhdCA6IGRhdGEubWRhdC5idWZmZXIsIG5iIDogZGF0YS5uYn07XG4gICAgICAvLyBwYXNzIG1vb2YvbWRhdCBkYXRhIGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsW29iakRhdGEubW9vZixvYmpEYXRhLm1kYXRdKTtcbiAgICB9KTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OmV2ZW50fSk7XG4gICAgfSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRVJST1IsIGZ1bmN0aW9uKGV2ZW50LGRhdGEpIHtcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OmV2ZW50LGRhdGE6ZGF0YX0pO1xuICAgIH0pO1xuICB9O1xuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXJXb3JrZXI7XG5cbiIsIlxuZXhwb3J0IHZhciBFcnJvclR5cGVzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG5ldHdvcmsgZXJyb3IgKGxvYWRpbmcgZXJyb3IgLyB0aW1lb3V0IC4uLilcbiAgTkVUV09SS19FUlJPUiA6ICAnaGxzTmV0d29ya0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtZWRpYSBFcnJvciAodmlkZW8vcGFyc2luZy9tZWRpYXNvdXJjZSBlcnJvcilcbiAgTUVESUFfRVJST1IgOiAgJ2hsc01lZGlhRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhbGwgb3RoZXIgZXJyb3JzXG4gIE9USEVSX0VSUk9SIDogICdobHNPdGhlckVycm9yJ1xufTtcblxuZXhwb3J0IHZhciBFcnJvckRldGFpbHMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZCBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfRVJST1IgOiAgJ21hbmlmZXN0TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX1RJTUVPVVQgOiAgJ21hbmlmZXN0TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IHBhcnNpbmcgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfUEFSU0lOR19FUlJPUiA6ICAnbWFuaWZlc3RQYXJzaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9FUlJPUiA6ICAnbGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQgOiAgJ2xldmVsTG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIHN3aXRjaCBlcnJvciAtIGRhdGE6IHsgbGV2ZWwgOiBmYXVsdHkgbGV2ZWwgSWQsIGV2ZW50IDogZXJyb3IgZGVzY3JpcHRpb259XG4gIExFVkVMX1NXSVRDSF9FUlJPUiA6ICAnbGV2ZWxTd2l0Y2hFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBGUkFHX0xPQURfRVJST1IgOiAgJ2ZyYWdMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SIDogICdmcmFnTG9vcExvYWRpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgdGltZW91dCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FEX1RJTUVPVVQgOiAgJ2ZyYWdMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19QQVJTSU5HX0VSUk9SIDogICdmcmFnUGFyc2luZ0Vycm9yJyxcbiAgICAvLyBJZGVudGlmaWVyIGZvciBhIGZyYWdtZW50IGFwcGVuZGluZyBlcnJvciBldmVudCAtIGRhdGE6IGFwcGVuZGluZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0FQUEVORElOR19FUlJPUiA6ICAnZnJhZ0FwcGVuZGluZ0Vycm9yJ1xufTtcbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBzdWNjZXNmdWxseSBhdHRhY2hlZCB0byB2aWRlbyBlbGVtZW50IC0gZGF0YTogeyBtZWRpYVNvdXJjZSB9XG4gIE1TRV9BVFRBQ0hFRCA6ICdobHNNZWRpYVNvdXJjZUF0dGFjaGVkJyxcbiAgLy8gZmlyZWQgdG8gc2lnbmFsIHRoYXQgYSBtYW5pZmVzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgdXJsIDogbWFuaWZlc3RVUkx9XG4gIE1BTklGRVNUX0xPQURJTkcgIDogJ2hsc01hbmlmZXN0TG9hZGluZycsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIGxvYWRlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCB1cmwgOiBtYW5pZmVzdFVSTCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX19XG4gIE1BTklGRVNUX0xPQURFRCAgOiAnaGxzTWFuaWZlc3RMb2FkZWQnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBwYXJzZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgZmlyc3RMZXZlbCA6IGluZGV4IG9mIGZpcnN0IHF1YWxpdHkgbGV2ZWwgYXBwZWFyaW5nIGluIE1hbmlmZXN0fVxuICBNQU5JRkVTVF9QQVJTRUQgIDogJ2hsc01hbmlmZXN0UGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBsZXZlbCBVUkwgIGxldmVsIDogaWQgb2YgbGV2ZWwgYmVpbmcgbG9hZGVkfVxuICBMRVZFTF9MT0FESU5HICAgIDogJ2hsc0xldmVsTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIGZpbmlzaGVzIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiBsb2FkZWQgbGV2ZWwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9IH1cbiAgTEVWRUxfTE9BREVEIDogICdobHNMZXZlbExvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBzd2l0Y2ggaXMgcmVxdWVzdGVkIC0gZGF0YTogeyBsZXZlbCA6IGlkIG9mIG5ldyBsZXZlbCB9XG4gIExFVkVMX1NXSVRDSCA6ICAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORyA6ICAnaGxzRnJhZ0xvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBwcm9ncmVzc2luZyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgeyB0cmVxdWVzdCwgdGZpcnN0LCBsb2FkZWR9fVxuICBGUkFHX0xPQURfUFJPR1JFU1MgOiAgJ2hsc0ZyYWdMb2FkUHJvZ3Jlc3MnLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIGFib3J0aW5nIGZvciBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gLSBkYXRhOiB7ZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVEIDogICdobHNGcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEIDogICdobHNGcmFnTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBJbml0IFNlZ21lbnQgaGFzIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb3YgOiBtb292IE1QNCBib3gsIGNvZGVjcyA6IGNvZGVjcyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50fVxuICBGUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UIDogICdobHNGcmFnUGFyc2luZ0luaXRTZWdtZW50JyxcbiAgLy8gZmlyZWQgd2hlbiBtb29mL21kYXQgaGF2ZSBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb29mIDogbW9vZiBNUDQgYm94LCBtZGF0IDogbWRhdCBNUDQgYm94fVxuICBGUkFHX1BBUlNJTkdfREFUQSA6ICAnaGxzRnJhZ1BhcnNpbmdEYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBwYXJzaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHVuZGVmaW5lZFxuICBGUkFHX1BBUlNFRCA6ICAnaGxzRnJhZ1BhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcmVtdXhlZCBNUDQgYm94ZXMgaGF2ZSBhbGwgYmVlbiBhcHBlbmRlZCBpbnRvIFNvdXJjZUJ1ZmZlciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCB0cGFyc2VkLCB0YnVmZmVyZWQsIGxlbmd0aH0gfVxuICBGUkFHX0JVRkZFUkVEIDogICdobHNGcmFnQnVmZmVyZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IG1hdGNoaW5nIHdpdGggY3VycmVudCB2aWRlbyBwb3NpdGlvbiBpcyBjaGFuZ2luZyAtIGRhdGEgOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QgfVxuICBGUkFHX0NIQU5HRUQgOiAgJ2hsc0ZyYWdDaGFuZ2VkJyxcbiAgICAvLyBJZGVudGlmaWVyIGZvciBhIEZQUyBkcm9wIGV2ZW50IC0gZGF0YToge2N1cmVudERyb3BwZWQsIGN1cnJlbnREZWNvZGVkLCB0b3RhbERyb3BwZWRGcmFtZXN9XG4gIEZQU19EUk9QIDogICdobHNGUFNEcm9wJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYW4gZXJyb3IgZXZlbnQgLSBkYXRhOiB7IHR5cGUgOiBlcnJvciB0eXBlLCBkZXRhaWxzIDogZXJyb3IgZGV0YWlscywgZmF0YWwgOiBpZiB0cnVlLCBobHMuanMgY2Fubm90L3dpbGwgbm90IHRyeSB0byByZWNvdmVyLCBpZiBmYWxzZSwgaGxzLmpzIHdpbGwgdHJ5IHRvIHJlY292ZXIsb3RoZXIgZXJyb3Igc3BlY2lmaWMgZGF0YX1cbiAgRVJST1IgOiAnaGxzRXJyb3InXG59O1xuIiwiLyoqXG4gKiBITFMgaW50ZXJmYWNlXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgICAgICAgIGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcyxFcnJvckRldGFpbHN9ICBmcm9tICcuL2Vycm9ycyc7XG5pbXBvcnQgU3RhdHNIYW5kbGVyICAgICAgICAgICAgICAgZnJvbSAnLi9zdGF0cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgICAgICAgZnJvbSAnLi9vYnNlcnZlcic7XG5pbXBvcnQgUGxheWxpc3RMb2FkZXIgICAgICAgICAgICAgZnJvbSAnLi9sb2FkZXIvcGxheWxpc3QtbG9hZGVyJztcbmltcG9ydCBGcmFnbWVudExvYWRlciAgICAgICAgICAgICBmcm9tICcuL2xvYWRlci9mcmFnbWVudC1sb2FkZXInO1xuaW1wb3J0IEJ1ZmZlckNvbnRyb2xsZXIgICAgICAgICAgIGZyb20gJy4vY29udHJvbGxlci9idWZmZXItY29udHJvbGxlcic7XG5pbXBvcnQgTGV2ZWxDb250cm9sbGVyICAgICAgICAgICAgZnJvbSAnLi9jb250cm9sbGVyL2xldmVsLWNvbnRyb2xsZXInO1xuLy9pbXBvcnQgRlBTQ29udHJvbGxlciAgICAgICAgICAgICAgZnJvbSAnLi9jb250cm9sbGVyL2Zwcy1jb250cm9sbGVyJztcbmltcG9ydCB7bG9nZ2VyLGVuYWJsZUxvZ3N9ICAgICAgICBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgWGhyTG9hZGVyICAgICAgICAgICAgICAgICAgZnJvbSAnLi91dGlscy94aHItbG9hZGVyJztcblxuY2xhc3MgSGxzIHtcblxuICBzdGF0aWMgaXNTdXBwb3J0ZWQoKSB7XG4gICAgcmV0dXJuICh3aW5kb3cuTWVkaWFTb3VyY2UgJiYgTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQ7IGNvZGVjcz1cImF2YzEuNDJFMDFFLG1wNGEuNDAuMlwiJykpO1xuICB9XG5cbiAgc3RhdGljIGdldCBFdmVudHMoKSB7XG4gICAgcmV0dXJuIEV2ZW50O1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvclR5cGVzKCkge1xuICAgIHJldHVybiBFcnJvclR5cGVzO1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvckRldGFpbHMoKSB7XG4gICAgcmV0dXJuIEVycm9yRGV0YWlscztcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9KSB7XG4gICB2YXIgY29uZmlnRGVmYXVsdCA9IHtcbiAgICAgIGF1dG9TdGFydExvYWQgOiB0cnVlLFxuICAgICAgZGVidWcgOiBmYWxzZSxcbiAgICAgIG1heEJ1ZmZlckxlbmd0aCA6IDMwLFxuICAgICAgbWF4QnVmZmVyU2l6ZSA6IDYwKjEwMDAqMTAwMCxcbiAgICAgIGVuYWJsZVdvcmtlciA6IHRydWUsXG4gICAgICBmcmFnTG9hZGluZ1RpbWVPdXQgOiAyMDAwMCxcbiAgICAgIGZyYWdMb2FkaW5nTWF4UmV0cnkgOiAxLFxuICAgICAgZnJhZ0xvYWRpbmdSZXRyeURlbGF5IDogMTAwMCxcbiAgICAgIGZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZCA6IDMsXG4gICAgICBtYW5pZmVzdExvYWRpbmdUaW1lT3V0IDogMTAwMDAsXG4gICAgICBtYW5pZmVzdExvYWRpbmdNYXhSZXRyeSA6IDEsXG4gICAgICBtYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5IDogMTAwMCxcbiAgICAgIGZwc0Ryb3BwZWRNb25pdG9yaW5nUGVyaW9kIDogNTAwMCxcbiAgICAgIGZwc0Ryb3BwZWRNb25pdG9yaW5nVGhyZXNob2xkIDogMC4yLFxuICAgICAgYXBwZW5kRXJyb3JNYXhSZXRyeSA6IDIwMCxcbiAgICAgIGxvYWRlciA6IFhockxvYWRlclxuICAgIH07XG4gICAgZm9yICh2YXIgcHJvcCBpbiBjb25maWdEZWZhdWx0KSB7XG4gICAgICAgIGlmIChwcm9wIGluIGNvbmZpZykgeyBjb250aW51ZTsgfVxuICAgICAgICBjb25maWdbcHJvcF0gPSBjb25maWdEZWZhdWx0W3Byb3BdO1xuICAgIH1cbiAgICBlbmFibGVMb2dzKGNvbmZpZy5kZWJ1Zyk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IG5ldyBQbGF5bGlzdExvYWRlcih0aGlzKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyID0gbmV3IExldmVsQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIgPSBuZXcgQnVmZmVyQ29udHJvbGxlcih0aGlzKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlciA9IG5ldyBGUFNDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyID0gbmV3IFN0YXRzSGFuZGxlcih0aGlzKTtcbiAgICAvLyBvYnNlcnZlciBzZXR1cFxuICAgIHRoaXMub24gPSBvYnNlcnZlci5vbi5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLm9mZiA9IG9ic2VydmVyLm9mZi5iaW5kKG9ic2VydmVyKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnVubG9hZFNvdXJjZSgpO1xuICAgIHRoaXMuZGV0YWNoVmlkZW8oKTtcbiAgICBvYnNlcnZlci5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGF0dGFjaFZpZGVvKHZpZGVvKSB7XG4gICAgdGhpcy52aWRlbyA9IHZpZGVvO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyLmF0dGFjaFZpZGVvKHZpZGVvKTtcbiAgICAvLyBzZXR1cCB0aGUgbWVkaWEgc291cmNlXG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIC8vTWVkaWEgU291cmNlIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc28gPSB0aGlzLm9uTWVkaWFTb3VyY2VPcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NZWRpYVNvdXJjZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zYyA9IHRoaXMub25NZWRpYVNvdXJjZUNsb3NlLmJpbmQodGhpcyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgdmlkZW8uc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLHRoaXMub252ZXJyb3IpO1xuICB9XG5cbiAgZGV0YWNoVmlkZW8oKSB7XG4gICAgdmFyIHZpZGVvID0gdGhpcy52aWRlbztcbiAgICB0aGlzLnN0YXRzSGFuZGxlci5kZXRhY2hWaWRlbyh2aWRlbyk7XG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICBpZihtcykge1xuICAgICAgaWYobXMucmVhZHlTdGF0ZSAhPT0gJ2VuZGVkJykge1xuICAgICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgfVxuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB2aWRlby5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIGlmKHZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBsb2FkU291cmNlKHVybCkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIGxvZ2dlci5sb2coYGxvYWRTb3VyY2U6JHt1cmx9YCk7XG4gICAgLy8gd2hlbiBhdHRhY2hpbmcgdG8gYSBzb3VyY2UgVVJMLCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZFxuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BRElORywgeyB1cmw6IHVybCB9KTtcbiAgfVxuXG4gIHN0YXJ0TG9hZCgpIHtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIuc3RhcnRMb2FkKCk7XG4gIH1cblxuICByZWNvdmVyTWVkaWFFcnJvcigpIHtcbiAgICBsb2dnZXIubG9nKCd0cnkgdG8gcmVjb3ZlciBtZWRpYSBFcnJvcicpO1xuICAgIHZhciB2aWRlbyA9IHRoaXMudmlkZW87XG4gICAgdGhpcy5kZXRhY2hWaWRlbygpO1xuICAgIHRoaXMuYXR0YWNoVmlkZW8odmlkZW8pO1xuICB9XG5cbiAgdW5sb2FkU291cmNlKCkge1xuICAgIHRoaXMudXJsID0gbnVsbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gYWxsIHF1YWxpdHkgbGV2ZWxzICoqL1xuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbHM7XG4gIH1cblxuICAvKiogUmV0dXJuIGN1cnJlbnQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAqKi9cbiAgZ2V0IGN1cnJlbnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXJDb250cm9sbGVyLmN1cnJlbnRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGltbWVkaWF0ZWx5ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGN1cnJlbnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubG9hZExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyLmltbWVkaWF0ZUxldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIG5leHQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAocXVhbGl0eSBsZXZlbCBvZiBuZXh0IGZyYWdtZW50KSAqKi9cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXJDb250cm9sbGVyLm5leHRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBuZXh0IGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IG5leHRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubG9hZExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyLm5leHRMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBjdXJyZW50L2xhc3QgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBjdXJyZW50L25leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbmV4dExvYWRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbCgpO1xuICB9XG5cbiAgLyoqIHNldCBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBzZXQgbmV4dExvYWRMZXZlbChsZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsID0gbGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsICA9PT0gLTEpO1xuICB9XG5cbiAgLyogcmV0dXJuIG1hbnVhbCBsZXZlbCAqL1xuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsO1xuICB9XG5cblxuICAvKiByZXR1cm4gcGxheWJhY2sgc2Vzc2lvbiBzdGF0cyAqL1xuICBnZXQgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHNIYW5kbGVyLnN0YXRzO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIG9wZW5lZCcpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTVNFX0FUVEFDSEVELCB7IHZpZGVvOiB0aGlzLnZpZGVvLCBtZWRpYVNvdXJjZSA6IHRoaXMubWVkaWFTb3VyY2UgfSk7XG4gICAgLy8gb25jZSByZWNlaXZlZCwgZG9uJ3QgbGlzdGVuIGFueW1vcmUgdG8gc291cmNlb3BlbiBldmVudFxuICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiIC8qXG4gKiBmcmFnbWVudCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIEZyYWdtZW50TG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscz1obHM7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FESU5HLCB0aGlzLm9uZmwpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19MT0FESU5HLCB0aGlzLm9uZmwpO1xuICB9XG5cbiAgb25GcmFnTG9hZGluZyhldmVudCxkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSBkYXRhLmZyYWc7XG4gICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICB0aGlzLmZyYWcubG9hZGVkID0gMDtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSBuZXcgY29uZmlnLmxvYWRlcigpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQoZnJhZy51cmwsJ2FycmF5YnVmZmVyJyx0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnksY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSx0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciBwYXlsb2FkID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZTtcbiAgICBzdGF0cy5sZW5ndGggPSBwYXlsb2FkLmJ5dGVMZW5ndGg7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICB0aGlzLmZyYWcubG9hZGVyID0gdW5kZWZpbmVkO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgIHsgcGF5bG9hZCA6IHBheWxvYWQsXG4gICAgICAgICAgICAgICAgICAgICAgZnJhZyA6IHRoaXMuZnJhZyAsXG4gICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiBzdGF0c30pO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SLCBmYXRhbDpmYWxzZSxmcmFnIDogdGhpcy5mcmFnLCByZXNwb25zZTpldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7IHR5cGUgOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQsIGZhdGFsOmZhbHNlLGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcyhldmVudCwgc3RhdHMpIHtcbiAgICB0aGlzLmZyYWcubG9hZGVkID0gc3RhdHMubG9hZGVkO1xuICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHsgZnJhZyA6IHRoaXMuZnJhZywgc3RhdHMgOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIHBsYXlsaXN0IGxvYWRlclxuICpcbiAqL1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuLy9pbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFBsYXlsaXN0TG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGluZy5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BRElORywgdGhpcy5vbmxsKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51cmwgPSB0aGlzLmlkID0gbnVsbDtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuTEVWRUxfTE9BRElORywgdGhpcy5vbmxsKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsbnVsbCk7XG4gIH1cblxuICBvbkxldmVsTG9hZGluZyhldmVudCxkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLGRhdGEubGV2ZWwsZGF0YS5pZCk7XG4gIH1cblxuICBsb2FkKHVybCxpZDEsaWQyKSB7XG4gICAgdmFyIGNvbmZpZz10aGlzLmhscy5jb25maWc7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5pZCA9IGlkMTtcbiAgICB0aGlzLmlkMiA9IGlkMjtcbiAgICB0aGlzLmxvYWRlciA9IG5ldyBjb25maWcubG9hZGVyKCk7XG4gICAgdGhpcy5sb2FkZXIubG9hZCh1cmwsJycsdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5tYW5pZmVzdExvYWRpbmdUaW1lT3V0LCBjb25maWcubWFuaWZlc3RMb2FkaW5nTWF4UmV0cnksY29uZmlnLm1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXkpO1xuICB9XG5cbiAgcmVzb2x2ZSh1cmwsIGJhc2VVcmwpIHtcbiAgICB2YXIgZG9jICAgICAgPSBkb2N1bWVudCxcbiAgICAgICAgb2xkQmFzZSA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYmFzZScpWzBdLFxuICAgICAgICBvbGRIcmVmID0gb2xkQmFzZSAmJiBvbGRCYXNlLmhyZWYsXG4gICAgICAgIGRvY0hlYWQgPSBkb2MuaGVhZCB8fCBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXSxcbiAgICAgICAgb3VyQmFzZSA9IG9sZEJhc2UgfHwgZG9jSGVhZC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnYmFzZScpKSxcbiAgICAgICAgcmVzb2x2ZXIgPSBkb2MuY3JlYXRlRWxlbWVudCgnYScpLFxuICAgICAgICByZXNvbHZlZFVybDtcblxuICAgIG91ckJhc2UuaHJlZiA9IGJhc2VVcmw7XG4gICAgcmVzb2x2ZXIuaHJlZiA9IHVybDtcbiAgICByZXNvbHZlZFVybCAgPSByZXNvbHZlci5ocmVmOyAvLyBicm93c2VyIG1hZ2ljIGF0IHdvcmsgaGVyZVxuXG4gICAgaWYgKG9sZEJhc2UpIHtvbGRCYXNlLmhyZWYgPSBvbGRIcmVmO31cbiAgICBlbHNlIHtkb2NIZWFkLnJlbW92ZUNoaWxkKG91ckJhc2UpO31cbiAgICByZXR1cm4gcmVzb2x2ZWRVcmw7XG4gIH1cblxuICBwYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZyxiYXNldXJsKSB7XG4gICAgdmFyIGxldmVscyA9IFtdLGxldmVsID0gIHt9LHJlc3VsdCxjb2RlY3MsY29kZWM7XG4gICAgdmFyIHJlID0gLyNFWFQtWC1TVFJFQU0tSU5GOihbXlxcblxccl0qKEJBTkQpV0lEVEg9KFxcZCspKT8oW15cXG5cXHJdKihDT0RFQ1MpPVxcXCIoLiopXFxcIiwpPyhbXlxcblxccl0qKFJFUylPTFVUSU9OPShcXGQrKXgoXFxkKykpPyhbXlxcblxccl0qKE5BTUUpPVxcXCIoLiopXFxcIik/W15cXG5cXHJdKltcXHJcXG5dKyhbXlxcclxcbl0rKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4peyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7fSk7XG4gICAgICBsZXZlbC51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0LnBvcCgpLGJhc2V1cmwpO1xuICAgICAgd2hpbGUocmVzdWx0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgc3dpdGNoKHJlc3VsdC5zaGlmdCgpKSB7XG4gICAgICAgICAgY2FzZSAnUkVTJzpcbiAgICAgICAgICAgIGxldmVsLndpZHRoID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgbGV2ZWwuaGVpZ2h0ID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnQkFORCc6XG4gICAgICAgICAgICBsZXZlbC5iaXRyYXRlID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnTkFNRSc6XG4gICAgICAgICAgICBsZXZlbC5uYW1lID0gcmVzdWx0LnNoaWZ0KCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdDT0RFQ1MnOlxuICAgICAgICAgICAgY29kZWNzID0gcmVzdWx0LnNoaWZ0KCkuc3BsaXQoJywnKTtcbiAgICAgICAgICAgIHdoaWxlKGNvZGVjcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIGNvZGVjID0gY29kZWNzLnNoaWZ0KCk7XG4gICAgICAgICAgICAgIGlmKGNvZGVjLmluZGV4T2YoJ2F2YzEnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBsZXZlbC52aWRlb0NvZGVjID0gdGhpcy5hdmMxdG9hdmNvdGkoY29kZWMpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldmVsLmF1ZGlvQ29kZWMgPSBjb2RlYztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgICBsZXZlbCA9IHt9O1xuICAgIH1cbiAgICByZXR1cm4gbGV2ZWxzO1xuICB9XG5cbiAgYXZjMXRvYXZjb3RpKGNvZGVjKSB7XG4gICAgdmFyIHJlc3VsdCxhdmNkYXRhID0gY29kZWMuc3BsaXQoJy4nKTtcbiAgICBpZihhdmNkYXRhLmxlbmd0aCA+IDIpIHtcbiAgICAgIHJlc3VsdCA9IGF2Y2RhdGEuc2hpZnQoKSArICcuJztcbiAgICAgIHJlc3VsdCArPSBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJlc3VsdCArPSAoJzAwJyArIHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBjb2RlYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwsIGlkKSB7XG4gICAgdmFyIGN1cnJlbnRTTiA9IDAsdG90YWxkdXJhdGlvbiA9IDAsIGxldmVsID0geyB1cmwgOiBiYXNldXJsLCBmcmFnbWVudHMgOiBbXSwgbGl2ZSA6IHRydWUsIHN0YXJ0U04gOiAwfSwgcmVzdWx0LCByZWdleHAsIGNjID0gMDtcbiAgICByZWdleHAgPSAvKD86I0VYVC1YLShNRURJQS1TRVFVRU5DRSk6KFxcZCspKXwoPzojRVhULVgtKFRBUkdFVERVUkFUSU9OKTooXFxkKykpfCg/OiNFWFQoSU5GKTooW1xcZFxcLl0rKVteXFxyXFxuXSpbXFxyXFxuXSsoW15cXHJcXG5dKyl8KD86I0VYVC1YLShFTkRMSVNUKSl8KD86I0VYVC1YLShESVMpQ09OVElOVUlUWSkpL2c7XG4gICAgd2hpbGUoKHJlc3VsdCA9IHJlZ2V4cC5leGVjKHN0cmluZykpICE9PSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKXsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpO30pO1xuICAgICAgc3dpdGNoKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gbGV2ZWwuc3RhcnRTTiA9IHBhcnNlSW50KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1RBUkdFVERVUkFUSU9OJzpcbiAgICAgICAgICBsZXZlbC50YXJnZXRkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRU5ETElTVCc6XG4gICAgICAgICAgbGV2ZWwubGl2ZSA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdESVMnOlxuICAgICAgICAgIGNjKys7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0lORic6XG4gICAgICAgICAgdmFyIGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGxldmVsLmZyYWdtZW50cy5wdXNoKHt1cmwgOiB0aGlzLnJlc29sdmUocmVzdWx0WzJdLGJhc2V1cmwpLCBkdXJhdGlvbiA6IGR1cmF0aW9uLCBzdGFydCA6IHRvdGFsZHVyYXRpb24sIHNuIDogY3VycmVudFNOKyssIGxldmVsOmlkLCBjYyA6IGNjfSk7XG4gICAgICAgICAgdG90YWxkdXJhdGlvbis9ZHVyYXRpb247XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZm91bmQgJyArIGxldmVsLmZyYWdtZW50cy5sZW5ndGggKyAnIGZyYWdtZW50cycpO1xuICAgIGxldmVsLnRvdGFsZHVyYXRpb24gPSB0b3RhbGR1cmF0aW9uO1xuICAgIGxldmVsLmVuZFNOID0gY3VycmVudFNOIC0gMTtcbiAgICByZXR1cm4gbGV2ZWw7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgc3RyaW5nID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVRleHQsIHVybCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VVUkwsIGlkID0gdGhpcy5pZCxpZDI9IHRoaXMuaWQyLCBsZXZlbHM7XG4gICAgLy8gcmVzcG9uc2VVUkwgbm90IHN1cHBvcnRlZCBvbiBzb21lIGJyb3dzZXJzIChpdCBpcyB1c2VkIHRvIGRldGVjdCBVUkwgcmVkaXJlY3Rpb24pXG4gICAgaWYodXJsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGZhbGxiYWNrIHRvIGluaXRpYWwgVVJMXG4gICAgICB1cmwgPSB0aGlzLnVybDtcbiAgICB9XG4gICAgc3RhdHMudGxvYWQgPSBuZXcgRGF0ZSgpO1xuICAgIHN0YXRzLm10aW1lID0gbmV3IERhdGUoZXZlbnQuY3VycmVudFRhcmdldC5nZXRSZXNwb25zZUhlYWRlcignTGFzdC1Nb2RpZmllZCcpKTtcblxuICAgIGlmKHN0cmluZy5pbmRleE9mKCcjRVhUTTNVJykgPT09IDApIHtcbiAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVElORjonKSA+IDApIHtcbiAgICAgICAgLy8gMSBsZXZlbCBwbGF5bGlzdFxuICAgICAgICAvLyBpZiBmaXJzdCByZXF1ZXN0LCBmaXJlIG1hbmlmZXN0IGxvYWRlZCBldmVudCwgbGV2ZWwgd2lsbCBiZSByZWxvYWRlZCBhZnRlcndhcmRzXG4gICAgICAgIC8vICh0aGlzIGlzIHRvIGhhdmUgYSB1bmlmb3JtIGxvZ2ljIGZvciAxIGxldmVsL211bHRpbGV2ZWwgcGxheWxpc3RzKVxuICAgICAgICBpZih0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogW3t1cmwgOiB1cmx9XSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiB1cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiBzdGF0c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgICB7IGRldGFpbHMgOiB0aGlzLnBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsdXJsLGlkKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbCA6IGlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkIDogaWQyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogc3RhdHN9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzID0gdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZyx1cmwpO1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICBpZihsZXZlbHMubGVuZ3RoKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogbGV2ZWxzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwgeyB0eXBlIDogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOnRydWUsIHVybCA6IHVybCwgcmVhc29uIDogJ25vIGxldmVsIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHsgdHlwZSA6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDp0cnVlLCB1cmwgOiB1cmwsIHJlYXNvbiA6ICdubyBFWFRNM1UgZGVsaW1pdGVyJ30pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHZhciBkZXRhaWxzLGZhdGFsO1xuICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9FUlJPUjtcbiAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczpkZXRhaWxzLCBmYXRhbDpmYXRhbCwgdXJsOnRoaXMudXJsLCBsb2FkZXIgOiB0aGlzLmxvYWRlciwgcmVzcG9uc2U6ZXZlbnQuY3VycmVudFRhcmdldCwgbGV2ZWw6IHRoaXMuaWQsIGlkIDogdGhpcy5pZDJ9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHZhciBkZXRhaWxzLGZhdGFsO1xuICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDtcbiAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgfVxuICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHsgdHlwZSA6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczpkZXRhaWxzLCBmYXRhbDpmYXRhbCwgdXJsIDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIGxldmVsOiB0aGlzLmlkLCBpZCA6IHRoaXMuaWQyfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCJpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5cbmxldCBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcblxub2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbn07XG5cbm9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIC4uLmRhdGEpO1xufTtcblxuXG5leHBvcnQgZGVmYXVsdCBvYnNlcnZlcjtcbiIsIi8qKlxuICogZ2VuZXJhdGUgTVA0IEJveFxuICovXG5cbmNsYXNzIE1QNCB7XG4gIHN0YXRpYyBpbml0KCkge1xuICAgIE1QNC50eXBlcyA9IHtcbiAgICAgIGF2YzE6IFtdLCAvLyBjb2RpbmduYW1lXG4gICAgICBhdmNDOiBbXSxcbiAgICAgIGJ0cnQ6IFtdLFxuICAgICAgZGluZjogW10sXG4gICAgICBkcmVmOiBbXSxcbiAgICAgIGVzZHM6IFtdLFxuICAgICAgZnR5cDogW10sXG4gICAgICBoZGxyOiBbXSxcbiAgICAgIG1kYXQ6IFtdLFxuICAgICAgbWRoZDogW10sXG4gICAgICBtZGlhOiBbXSxcbiAgICAgIG1maGQ6IFtdLFxuICAgICAgbWluZjogW10sXG4gICAgICBtb29mOiBbXSxcbiAgICAgIG1vb3Y6IFtdLFxuICAgICAgbXA0YTogW10sXG4gICAgICBtdmV4OiBbXSxcbiAgICAgIG12aGQ6IFtdLFxuICAgICAgc2R0cDogW10sXG4gICAgICBzdGJsOiBbXSxcbiAgICAgIHN0Y286IFtdLFxuICAgICAgc3RzYzogW10sXG4gICAgICBzdHNkOiBbXSxcbiAgICAgIHN0c3o6IFtdLFxuICAgICAgc3R0czogW10sXG4gICAgICB0ZmR0OiBbXSxcbiAgICAgIHRmaGQ6IFtdLFxuICAgICAgdHJhZjogW10sXG4gICAgICB0cmFrOiBbXSxcbiAgICAgIHRydW46IFtdLFxuICAgICAgdHJleDogW10sXG4gICAgICB0a2hkOiBbXSxcbiAgICAgIHZtaGQ6IFtdLFxuICAgICAgc21oZDogW11cbiAgICB9O1xuXG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIE1QNC50eXBlcykge1xuICAgICAgaWYgKE1QNC50eXBlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBNUDQudHlwZXNbaV0gPSBbXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDApLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgxKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMiksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDMpXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgTVA0Lk1BSk9SX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2knLmNoYXJDb2RlQXQoMCksXG4gICAgICAncycuY2hhckNvZGVBdCgwKSxcbiAgICAgICdvJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ20nLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuQVZDMV9CUkFORCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICdhJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ3YnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnYycuY2hhckNvZGVBdCgwKSxcbiAgICAgICcxJy5jaGFyQ29kZUF0KDApXG4gICAgXSk7XG4gICAgTVA0Lk1JTk9SX1ZFUlNJT04gPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMV0pO1xuICAgIE1QNC5WSURFT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuQVVESU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOk1QNC5WSURFT19IRExSLFxuICAgICAgJ2F1ZGlvJzpNUDQuQVVESU9fSERMUlxuICAgIH07XG4gICAgTVA0LkRSRUYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG4gICAgTVA0LlNUQ08gPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCAvLyBlbnRyeV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5TVFNDID0gTVA0LlNUQ087XG4gICAgTVA0LlNUVFMgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIE1QNC5NQUpPUl9CUkFORCwgTVA0Lk1JTk9SX1ZFUlNJT04sIE1QNC5NQUpPUl9CUkFORCwgTVA0LkFWQzFfQlJBTkQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgTVA0LkRSRUYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gMCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgcmVzdWx0LFxuICAgIHZpZXc7XG5cbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShzaXplICsgOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhyZXN1bHQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLCByZXN1bHQuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcblxuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBwYXlsb2FkLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZCh0aW1lc2NhbGUsZHVyYXRpb24pIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMywgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICh0aW1lc2NhbGUgPj4gMjQpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgIHRpbWVzY2FsZSAmIDB4RkYsIC8vIHRpbWVzY2FsZVxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDU1LCAweGM0LCAvLyAndW5kJyBsYW5ndWFnZSAodW5kZXRlcm1pbmVkKVxuICAgICAgMHgwMCwgMHgwMFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGlhKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaWEsIE1QNC5tZGhkKHRyYWNrLnRpbWVzY2FsZSx0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMjQpLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gIDgpICYgMHhGRixcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnNtaGQsIE1QNC5TTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy52bWhkLCBNUDQuVk1IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBtb29mKHNuLCBiYXNlTWVkaWFEZWNvZGVUaW1lLCB0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tb29mLFxuICAgICAgICAgICAgICAgICAgIE1QNC5tZmhkKHNuKSxcbiAgICAgICAgICAgICAgICAgICBNUDQudHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSk7XG4gIH1cbi8qKlxuICogQHBhcmFtIHRyYWNrcy4uLiAob3B0aW9uYWwpIHthcnJheX0gdGhlIHRyYWNrcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBtb3ZpZVxuICovXG4gIHN0YXRpYyBtb292KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJhayh0cmFja3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubW9vdiwgTVA0Lm12aGQodHJhY2tzWzBdLnRpbWVzY2FsZSx0cmFja3NbMF0uZHVyYXRpb24pXS5jb25jYXQoYm94ZXMpLmNvbmNhdChNUDQubXZleCh0cmFja3MpKSk7XG4gIH1cblxuICBzdGF0aWMgbXZleCh0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyZXgodHJhY2tzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tdmV4XS5jb25jYXQoYm94ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmhkKHRpbWVzY2FsZSxkdXJhdGlvbikge1xuICAgIHZhclxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAgICh0aW1lc2NhbGUgPj4gMjQpICYgMHhGRixcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAxNikgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIHRpbWVzY2FsZSAmIDB4RkYsIC8vIHRpbWVzY2FsZVxuICAgICAgICAoZHVyYXRpb24gPj4gMjQpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsIC8vIDEuMCByYXRlXG4gICAgICAgIDB4MDEsIDB4MDAsIC8vIDEuMCB2b2x1bWVcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweGZmLCAweGZmLCAweGZmLCAweGZmIC8vIG5leHRfdHJhY2tfSURcbiAgICAgIF0pO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tdmhkLCBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc2R0cCh0cmFjaykge1xuICAgIHZhclxuICAgICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KDQgKyBzYW1wbGVzLmxlbmd0aCksXG4gICAgICBmbGFncyxcbiAgICAgIGk7XG5cbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGFncyA9IHNhbXBsZXNbaV0uZmxhZ3M7XG4gICAgICBieXRlc1tpICsgNF0gPSAoZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc2R0cCxcbiAgICAgICAgICAgICAgIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsXG4gICAgICAgICAgICAgICBNUDQuc3RzZCh0cmFjayksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHRzLCBNUDQuU1RUUyksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHN6LCBNUDQuU1RTWiksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdGNvLCBNUDQuU1RDTykpO1xuICB9XG5cbiAgc3RhdGljIGF2YzEodHJhY2spIHtcbiAgICB2YXIgc3BzID0gW10sIHBwcyA9IFtdLCBpO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnNwcy5sZW5ndGg7IGkrKykge1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoID4+PiA4KSAmIDB4RkYpO1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpOyAvLyBzZXF1ZW5jZVBhcmFtZXRlclNldExlbmd0aFxuICAgICAgc3BzID0gc3BzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5zcHNbaV0pKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggPj4+IDgpICYgMHhGRik7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRyYWNrLnBwc1tpXSkpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5hdmMxLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgICh0cmFjay53aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLndpZHRoICYgMHhmZiwgLy8gd2lkdGhcbiAgICAgICAgKHRyYWNrLmhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmhlaWdodCAmIDB4ZmYsIC8vIGhlaWdodFxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gdmVydHJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgICAgMHgxMyxcbiAgICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgICAgMHg2ZiwgMHg2YSwgMHg3MywgMHgyZCxcbiAgICAgICAgMHg2MywgMHg2ZiwgMHg2ZSwgMHg3NCxcbiAgICAgICAgMHg3MiwgMHg2OSwgMHg2MiwgMHgyZCxcbiAgICAgICAgMHg2OCwgMHg2YywgMHg3MywgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgICAgMHgwMCwgMHgxOCwgLy8gZGVwdGggPSAyNFxuICAgICAgICAweDExLCAweDExXSksIC8vIHByZV9kZWZpbmVkID0gLTFcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5hdmNDLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAxLCAvLyBjb25maWd1cmF0aW9uVmVyc2lvblxuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUlkYywgLy8gQVZDUHJvZmlsZUluZGljYXRpb25cbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXQsIC8vIHByb2ZpbGVfY29tcGF0aWJpbGl0eVxuICAgICAgICAgICAgdHJhY2subGV2ZWxJZGMsIC8vIEFWQ0xldmVsSW5kaWNhdGlvblxuICAgICAgICAgICAgMHhmZiAvLyBsZW5ndGhTaXplTWludXNPbmUsIGhhcmQtY29kZWQgdG8gNCBieXRlc1xuICAgICAgICAgIF0uY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnNwcy5sZW5ndGggLy8gbnVtT2ZTZXF1ZW5jZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQoc3BzKS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2sucHBzLmxlbmd0aCAvLyBudW1PZlBpY3R1cmVQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHBwcykpKSwgLy8gXCJQUFNcIlxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmJ0cnQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDAsIDB4MWMsIDB4OWMsIDB4ODAsIC8vIGJ1ZmZlclNpemVEQlxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMF0pKSAvLyBhdmdCaXRyYXRlXG4gICAgICAgICAgKTtcbiAgfVxuXG4gIHN0YXRpYyBlc2RzKHRyYWNrKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcblxuICAgICAgMHgwMywgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDE3K3RyYWNrLmNvbmZpZy5sZW5ndGgsIC8vIGxlbmd0aFxuICAgICAgMHgwMCwgMHgwMSwgLy9lc19pZFxuICAgICAgMHgwMCwgLy8gc3RyZWFtX3ByaW9yaXR5XG5cbiAgICAgIDB4MDQsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgwZit0cmFjay5jb25maWcubGVuZ3RoLCAvLyBsZW5ndGhcbiAgICAgIDB4NDAsIC8vY29kZWMgOiBtcGVnNF9hdWRpb1xuICAgICAgMHgxNSwgLy8gc3RyZWFtX3R5cGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGJ1ZmZlcl9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBhdmdCaXRyYXRlXG5cbiAgICAgIDB4MDUgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICBdLmNvbmNhdChbdHJhY2suY29uZmlnLmxlbmd0aF0pLmNvbmNhdCh0cmFjay5jb25maWcpLmNvbmNhdChbMHgwNiwgMHgwMSwgMHgwMl0pKTsgLy8gR0FTcGVjaWZpY0NvbmZpZykpOyAvLyBsZW5ndGggKyBhdWRpbyBjb25maWcgZGVzY3JpcHRvclxuICB9XG5cbiAgc3RhdGljIG1wNGEodHJhY2spIHtcbiAgICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1wNGEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgdHJhY2suY2hhbm5lbENvdW50LCAvLyBjaGFubmVsY291bnRcbiAgICAgICAgMHgwMCwgMHgxMCwgLy8gc2FtcGxlU2l6ZToxNmJpdHNcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWQyXG4gICAgICAgICh0cmFjay5hdWRpb3NhbXBsZXJhdGUgPj4gOCkgJiAweEZGLFxuICAgICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgJiAweGZmLCAvL1xuICAgICAgICAweDAwLCAweDAwXSksXG4gICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmVzZHMsIE1QNC5lc2RzKHRyYWNrKSkpO1xuICB9XG5cbiAgc3RhdGljIHN0c2QodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNEICwgTVA0Lm1wNGEodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNEICwgTVA0LmF2YzEodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdGtoZCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50a2hkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDcsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRyYWNrLmlkID4+IDI0KSAmIDB4RkYsXG4gICAgICAodHJhY2suaWQgPj4gMTYpICYgMHhGRixcbiAgICAgICh0cmFjay5pZCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5pZCAmIDB4RkYsIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+IDI0KSxcbiAgICAgICh0cmFjay5kdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5kdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgICAweDAwLCAweDAwLCAvLyBhbHRlcm5hdGVfZ3JvdXBcbiAgICAgIDB4MDAsIDB4MDAsIC8vIG5vbi1hdWRpbyB0cmFjayB2b2x1bWVcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICh0cmFjay53aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay53aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKHRyYWNrLmhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5oZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAyNCksXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4yNCksXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLFxuICAgICAgICAgICAgICAgTVA0LnRraGQodHJhY2spLFxuICAgICAgICAgICAgICAgTVA0Lm1kaWEodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmV4KHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyZXgsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgKHRyYWNrLmlkID4+IDI0KSxcbiAgICAgKHRyYWNrLmlkID4+IDE2KSAmIDBYRkYsXG4gICAgICh0cmFjay5pZCA+PiA4KSAmIDBYRkYsXG4gICAgICh0cmFjay5pZCAmIDB4RkYpLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZGVmYXVsdF9zYW1wbGVfZGVzY3JpcHRpb25faW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX2R1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAxIC8vIGRlZmF1bHRfc2FtcGxlX2ZsYWdzXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRydW4odHJhY2ssIG9mZnNldCkge1xuICAgIHZhciBzYW1wbGVzLCBzYW1wbGUsIGksIGFycmF5O1xuXG4gICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW107XG4gICAgYXJyYXkgPSBuZXcgVWludDhBcnJheSgxMiArICgxNiAqIHNhbXBsZXMubGVuZ3RoKSk7XG4gICAgb2Zmc2V0ICs9IDggKyBhcnJheS5ieXRlTGVuZ3RoO1xuXG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gOCkgJiAweEZGLFxuICAgICAgc2FtcGxlcy5sZW5ndGggJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF0sMCk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGFycmF5LnNldChbXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLmR1cmF0aW9uICYgMHhGRiwgLy8gc2FtcGxlX2R1cmF0aW9uXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLnNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgICAoc2FtcGxlLmZsYWdzLmlzTGVhZGluZyA8PCAyKSB8IHNhbXBsZS5mbGFncy5kZXBlbmRzT24sXG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDYpIHxcbiAgICAgICAgICAoc2FtcGxlLmZsYWdzLmhhc1JlZHVuZGFuY3kgPDwgNCkgfFxuICAgICAgICAgIChzYW1wbGUuZmxhZ3MucGFkZGluZ1ZhbHVlIDw8IDEpIHxcbiAgICAgICAgICBzYW1wbGUuZmxhZ3MuaXNOb25TeW5jLFxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkUHJpbyAmIDB4RjAgPDwgOCxcbiAgICAgICAgc2FtcGxlLmZsYWdzLmRlZ3JhZFByaW8gJiAweDBGLCAvLyBzYW1wbGVfZmxhZ3NcbiAgICAgICAgKHNhbXBsZS5jdHMgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuY3RzID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmN0cyA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuY3RzICYgMHhGRiAvLyBzYW1wbGVfY29tcG9zaXRpb25fdGltZV9vZmZzZXRcbiAgICAgIF0sMTIrMTYqaSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cnVuLCBhcnJheSk7XG4gIH1cblxuICBzdGF0aWMgaW5pdFNlZ21lbnQodHJhY2tzKSB7XG5cbiAgICBpZighTVA0LnR5cGVzKSB7XG4gICAgICBNUDQuaW5pdCgpO1xuICAgIH1cbiAgICB2YXJcbiAgICAgIG1vdmllID0gTVA0Lm1vb3YodHJhY2tzKSxcbiAgICAgIHJlc3VsdDtcblxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KE1QNC5GVFlQLmJ5dGVMZW5ndGggKyBtb3ZpZS5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KE1QNC5GVFlQKTtcbiAgICByZXN1bHQuc2V0KG1vdmllLCBNUDQuRlRZUC5ieXRlTGVuZ3RoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1QNDtcblxuXG4iLCIgLypcbiAqIFN0YXRzIEhhbmRsZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuL29ic2VydmVyJztcblxuIGNsYXNzIFN0YXRzSGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHM9aGxzO1xuICAgIHRoaXMub25tcCA9IHRoaXMub25NYW5pZmVzdFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mYyA9IHRoaXMub25GcmFnbWVudENoYW5nZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmIgPSB0aGlzLm9uRnJhZ21lbnRCdWZmZXJlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbGVhID0gdGhpcy5vbkZyYWdtZW50TG9hZEVtZXJnZW5jeUFib3J0ZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZXJyID0gdGhpcy5vbkVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwc2QgPSB0aGlzLm9uRlBTRHJvcC5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0JVRkZFUkVELCB0aGlzLm9uZmIpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfQ0hBTkdFRCwgdGhpcy5vbmZjKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB0aGlzLm9uZmxlYSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlBTX0RST1AsIHRoaXMub25mcHNkKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19CVUZGRVJFRCwgdGhpcy5vbmZiKTtcbiAgICBvYnNlcnZlci5vZmYoRXZlbnQuRlJBR19DSEFOR0VELCB0aGlzLm9uZmMpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgb2JzZXJ2ZXIub2ZmKEV2ZW50LkZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCwgdGhpcy5vbmZsZWEpO1xuICAgIG9ic2VydmVyLm9mZihFdmVudC5GUFNfRFJPUCwgdGhpcy5vbmZwc2QpO1xuICB9XG5cbiAgYXR0YWNoVmlkZW8odmlkZW8pIHtcbiAgICB0aGlzLnZpZGVvID0gdmlkZW87XG4gIH1cblxuICBkZXRhY2hWaWRlbygpIHtcbiAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgfVxuXG4gIC8vIHJlc2V0IHN0YXRzIG9uIG1hbmlmZXN0IHBhcnNlZFxuICBvbk1hbmlmZXN0UGFyc2VkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLl9zdGF0cyA9IHsgdGVjaCA6ICdobHMuanMnLCBsZXZlbE5iIDogZGF0YS5sZXZlbHMubGVuZ3RofTtcbiAgfVxuXG4gIC8vIG9uIGZyYWdtZW50IGNoYW5nZWQgaXMgdHJpZ2dlcmVkIHdoZW5ldmVyIHBsYXliYWNrIG9mIGEgbmV3IGZyYWdtZW50IGlzIHN0YXJ0aW5nIC4uLlxuICBvbkZyYWdtZW50Q2hhbmdlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5fc3RhdHMsbGV2ZWwgPSBkYXRhLmZyYWcubGV2ZWwsYXV0b0xldmVsID0gZGF0YS5mcmFnLmF1dG9MZXZlbDtcbiAgICBpZihzdGF0cykge1xuICAgICAgaWYoc3RhdHMubGV2ZWxTdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHN0YXRzLmxldmVsU3RhcnQgPSBsZXZlbDtcbiAgICAgIH1cbiAgICAgIGlmKGF1dG9MZXZlbCkge1xuICAgICAgICBpZihzdGF0cy5mcmFnQ2hhbmdlZEF1dG8pIHtcbiAgICAgICAgICBzdGF0cy5hdXRvTGV2ZWxNaW4gPSBNYXRoLm1pbihzdGF0cy5hdXRvTGV2ZWxNaW4sbGV2ZWwpO1xuICAgICAgICAgIHN0YXRzLmF1dG9MZXZlbE1heCA9IE1hdGgubWF4KHN0YXRzLmF1dG9MZXZlbE1heCxsZXZlbCk7XG4gICAgICAgICAgc3RhdHMuZnJhZ0NoYW5nZWRBdXRvKys7XG4gICAgICAgICAgaWYodGhpcy5sZXZlbExhc3RBdXRvICYmIGxldmVsICE9PSBzdGF0cy5hdXRvTGV2ZWxMYXN0KSB7XG4gICAgICAgICAgICBzdGF0cy5hdXRvTGV2ZWxTd2l0Y2grKztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RhdHMuYXV0b0xldmVsTWluID0gc3RhdHMuYXV0b0xldmVsTWF4ID0gbGV2ZWw7XG4gICAgICAgICAgc3RhdHMuYXV0b0xldmVsU3dpdGNoID0gMDtcbiAgICAgICAgICBzdGF0cy5mcmFnQ2hhbmdlZEF1dG8gPSAxO1xuICAgICAgICAgIHRoaXMuc3VtQXV0b0xldmVsID0gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN1bUF1dG9MZXZlbCs9bGV2ZWw7XG4gICAgICAgIHN0YXRzLmF1dG9MZXZlbEF2ZyA9IE1hdGgucm91bmQoMTAwMCp0aGlzLnN1bUF1dG9MZXZlbC9zdGF0cy5mcmFnQ2hhbmdlZEF1dG8pLzEwMDA7XG4gICAgICAgIHN0YXRzLmF1dG9MZXZlbExhc3QgPSBsZXZlbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmKHN0YXRzLmZyYWdDaGFuZ2VkTWFudWFsKSB7XG4gICAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxNaW4gPSBNYXRoLm1pbihzdGF0cy5tYW51YWxMZXZlbE1pbixsZXZlbCk7XG4gICAgICAgICAgc3RhdHMubWFudWFsTGV2ZWxNYXggPSBNYXRoLm1heChzdGF0cy5tYW51YWxMZXZlbE1heCxsZXZlbCk7XG4gICAgICAgICAgc3RhdHMuZnJhZ0NoYW5nZWRNYW51YWwrKztcbiAgICAgICAgICBpZighdGhpcy5sZXZlbExhc3RBdXRvICYmIGxldmVsICE9PSBzdGF0cy5tYW51YWxMZXZlbExhc3QpIHtcbiAgICAgICAgICAgIHN0YXRzLm1hbnVhbExldmVsU3dpdGNoKys7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0YXRzLm1hbnVhbExldmVsTWluID0gc3RhdHMubWFudWFsTGV2ZWxNYXggPSBsZXZlbDtcbiAgICAgICAgICBzdGF0cy5tYW51YWxMZXZlbFN3aXRjaCA9IDA7XG4gICAgICAgICAgc3RhdHMuZnJhZ0NoYW5nZWRNYW51YWwgPSAxO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRzLm1hbnVhbExldmVsTGFzdCA9IGxldmVsO1xuICAgICAgfVxuICAgICAgdGhpcy5sZXZlbExhc3RBdXRvID0gYXV0b0xldmVsO1xuICAgIH1cbiAgfVxuXG4gIC8vIHRyaWdnZXJlZCBlYWNoIHRpbWUgYSBuZXcgZnJhZ21lbnQgaXMgYnVmZmVyZWRcbiAgb25GcmFnbWVudEJ1ZmZlcmVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLl9zdGF0cyxsYXRlbmN5ID0gZGF0YS5zdGF0cy50Zmlyc3QgLSBkYXRhLnN0YXRzLnRyZXF1ZXN0LCBwcm9jZXNzID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgLSBkYXRhLnN0YXRzLnRyZXF1ZXN0LCBiaXRyYXRlID0gTWF0aC5yb3VuZCg4KmRhdGEuc3RhdHMubGVuZ3RoLyhkYXRhLnN0YXRzLnRidWZmZXJlZCAtIGRhdGEuc3RhdHMudGZpcnN0KSk7XG4gICAgaWYoc3RhdHMuZnJhZ0J1ZmZlcmVkKSB7XG4gICAgICBzdGF0cy5mcmFnTWluTGF0ZW5jeSA9IE1hdGgubWluKHN0YXRzLmZyYWdNaW5MYXRlbmN5LGxhdGVuY3kpO1xuICAgICAgc3RhdHMuZnJhZ01heExhdGVuY3kgPSBNYXRoLm1heChzdGF0cy5mcmFnTWF4TGF0ZW5jeSxsYXRlbmN5KTtcbiAgICAgIHN0YXRzLmZyYWdNaW5Qcm9jZXNzID0gTWF0aC5taW4oc3RhdHMuZnJhZ01pblByb2Nlc3MscHJvY2Vzcyk7XG4gICAgICBzdGF0cy5mcmFnTWF4UHJvY2VzcyA9IE1hdGgubWF4KHN0YXRzLmZyYWdNYXhQcm9jZXNzLHByb2Nlc3MpO1xuICAgICAgc3RhdHMuZnJhZ01pbkticHMgPSBNYXRoLm1pbihzdGF0cy5mcmFnTWluS2JwcyxiaXRyYXRlKTtcbiAgICAgIHN0YXRzLmZyYWdNYXhLYnBzID0gTWF0aC5tYXgoc3RhdHMuZnJhZ01heEticHMsYml0cmF0ZSk7XG4gICAgICBzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWluID0gTWF0aC5taW4oc3RhdHMuYXV0b0xldmVsQ2FwcGluZ01pbix0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nKTtcbiAgICAgIHN0YXRzLmF1dG9MZXZlbENhcHBpbmdNYXggPSBNYXRoLm1heChzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWF4LHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmcpO1xuICAgICAgc3RhdHMuZnJhZ0J1ZmZlcmVkKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRzLmZyYWdNaW5MYXRlbmN5ID0gc3RhdHMuZnJhZ01heExhdGVuY3kgPSBsYXRlbmN5O1xuICAgICAgc3RhdHMuZnJhZ01pblByb2Nlc3MgPSBzdGF0cy5mcmFnTWF4UHJvY2VzcyA9IHByb2Nlc3M7XG4gICAgICBzdGF0cy5mcmFnTWluS2JwcyA9IHN0YXRzLmZyYWdNYXhLYnBzID0gYml0cmF0ZTtcbiAgICAgIHN0YXRzLmZyYWdCdWZmZXJlZCA9IDE7XG4gICAgICBzdGF0cy5mcmFnQnVmZmVyZWRCeXRlcyA9IDA7XG4gICAgICBzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTWluID0gc3RhdHMuYXV0b0xldmVsQ2FwcGluZ01heCA9IHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmc7XG4gICAgICB0aGlzLnN1bUxhdGVuY3k9MDtcbiAgICAgIHRoaXMuc3VtS2Jwcz0wO1xuICAgICAgdGhpcy5zdW1Qcm9jZXNzPTA7XG4gICAgfVxuICAgIHN0YXRzLmZyYWdsYXN0TGF0ZW5jeT1sYXRlbmN5O1xuICAgIHRoaXMuc3VtTGF0ZW5jeSs9bGF0ZW5jeTtcbiAgICBzdGF0cy5mcmFnQXZnTGF0ZW5jeSA9IE1hdGgucm91bmQodGhpcy5zdW1MYXRlbmN5L3N0YXRzLmZyYWdCdWZmZXJlZCk7XG4gICAgc3RhdHMuZnJhZ0xhc3RQcm9jZXNzPXByb2Nlc3M7XG4gICAgdGhpcy5zdW1Qcm9jZXNzKz1wcm9jZXNzO1xuICAgIHN0YXRzLmZyYWdBdmdQcm9jZXNzID0gTWF0aC5yb3VuZCh0aGlzLnN1bVByb2Nlc3Mvc3RhdHMuZnJhZ0J1ZmZlcmVkKTtcbiAgICBzdGF0cy5mcmFnTGFzdEticHM9Yml0cmF0ZTtcbiAgICB0aGlzLnN1bUticHMrPWJpdHJhdGU7XG4gICAgc3RhdHMuZnJhZ0F2Z0ticHMgPSBNYXRoLnJvdW5kKHRoaXMuc3VtS2Jwcy9zdGF0cy5mcmFnQnVmZmVyZWQpO1xuICAgIHN0YXRzLmZyYWdCdWZmZXJlZEJ5dGVzKz1kYXRhLnN0YXRzLmxlbmd0aDtcbiAgICBzdGF0cy5hdXRvTGV2ZWxDYXBwaW5nTGFzdCA9IHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZEVtZXJnZW5jeUFib3J0ZWQoKSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5fc3RhdHM7XG4gICAgaWYoc3RhdHMpIHtcbiAgICAgIGlmKHN0YXRzLmZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHN0YXRzLmZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCA9MTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXRzLmZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRXJyb3IoZXZlbnQsZGF0YSkge1xuICAgIHZhciBzdGF0cyA9IHRoaXMuX3N0YXRzO1xuICAgIGlmKHN0YXRzKSB7XG4gICAgICAvLyB0cmFjayBhbGwgZXJyb3JzIGluZGVwZW5kZW50bHlcbiAgICAgIGlmKHN0YXRzW2RhdGEuZGV0YWlsc10gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzdGF0c1tkYXRhLmRldGFpbHNdID0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdHNbZGF0YS5kZXRhaWxzXSs9MTtcbiAgICAgIH1cbiAgICAgIC8vIHRyYWNrIGZhdGFsIGVycm9yXG4gICAgICBpZihkYXRhLmZhdGFsKSB7XG4gICAgICAgIGlmKHN0YXRzLmZhdGFsRXJyb3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3RhdHMuZmF0YWxFcnJvcj0xO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdHMuZmF0YWxFcnJvcis9MTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRlBTRHJvcChldmVudCxkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5fc3RhdHM7XG4gICAgaWYoc3RhdHMpIHtcbiAgICAgaWYoc3RhdHMuZnBzRHJvcEV2ZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RhdHMuZnBzRHJvcEV2ZW50ID0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdHMuZnBzRHJvcEV2ZW50Kys7XG4gICAgICB9XG4gICAgICBzdGF0cy5mcHNUb3RhbERyb3BwZWRGcmFtZXMgPSBkYXRhLnRvdGFsRHJvcHBlZEZyYW1lcztcbiAgICB9XG4gIH1cblxuICBnZXQgc3RhdHMoKSB7XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdGhpcy5fc3RhdHMubGFzdFBvcyA9IHRoaXMudmlkZW8uY3VycmVudFRpbWUudG9GaXhlZCgzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0YXRzO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0YXRzSGFuZGxlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCgpe31cbmxldCBmYWtlTG9nZ2VyID0ge1xuICBsb2c6IG5vb3AsXG4gIHdhcm46IG5vb3AsXG4gIGluZm86IG5vb3AsXG4gIGVycm9yOiBub29wXG59O1xubGV0IGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcblxuZXhwb3J0IHZhciBlbmFibGVMb2dzID0gZnVuY3Rpb24oZGVidWcpIHtcbiAgaWYgKGRlYnVnID09PSB0cnVlIHx8IHR5cGVvZiBkZWJ1ZyAgICAgICA9PT0gJ29iamVjdCcpIHtcbiAgICBleHBvcnRlZExvZ2dlci5sb2cgICA9IGRlYnVnLmxvZyAgID8gZGVidWcubG9nLmJpbmQoZGVidWcpICAgOiBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLmluZm8gID0gZGVidWcuaW5mbyAgPyBkZWJ1Zy5pbmZvLmJpbmQoZGVidWcpICA6IGNvbnNvbGUuaW5mby5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLmVycm9yID0gZGVidWcuZXJyb3IgPyBkZWJ1Zy5lcnJvci5iaW5kKGRlYnVnKSA6IGNvbnNvbGUuZXJyb3IuYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci53YXJuICA9IGRlYnVnLndhcm4gID8gZGVidWcud2Fybi5iaW5kKGRlYnVnKSAgOiBjb25zb2xlLndhcm4uYmluZChjb25zb2xlKTtcblxuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG9uJ3QgYWxsb3cgdG8gdXNlIGJpbmQgb24gY29uc29sZSBvYmplY3QgYW55d2F5XG4gICAgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICBleHBvcnRlZExvZ2dlci5sb2coKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyAgID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmluZm8gID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmVycm9yID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gID0gbm9vcDtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICB9XG59O1xuZXhwb3J0IHZhciBsb2dnZXIgPSBleHBvcnRlZExvZ2dlcjtcbiIsIiAvKlxuICAqIFhociBiYXNlZCBMb2FkZXJcbiAgKlxuICAqL1xuXG5pbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFhockxvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuYWJvcnQoKTtcbiAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICBpZih0aGlzLmxvYWRlciAmJnRoaXMubG9hZGVyLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHRoaXMuc3RhdHMuYWJvcnRlZCA9IHRydWU7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICBpZih0aGlzLnRpbWVvdXRIYW5kbGUpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKHVybCxyZXNwb25zZVR5cGUsb25TdWNjZXNzLG9uRXJyb3Isb25UaW1lb3V0LHRpbWVvdXQsbWF4UmV0cnkscmV0cnlEZWxheSxvblByb2dyZXNzPW51bGwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLm9uU3VjY2VzcyA9IG9uU3VjY2VzcztcbiAgICB0aGlzLm9uUHJvZ3Jlc3MgPSBvblByb2dyZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy5zdGF0cyA9IHsgdHJlcXVlc3Q6bmV3IERhdGUoKSwgcmV0cnk6MH07XG4gICAgdGhpcy50aW1lb3V0ID0gdGltZW91dDtcbiAgICB0aGlzLm1heFJldHJ5ID0gbWF4UmV0cnk7XG4gICAgdGhpcy5yZXRyeURlbGF5ID0gcmV0cnlEZWxheTtcbiAgICB0aGlzLnRpbWVvdXRIYW5kbGUgPSB3aW5kb3cuc2V0VGltZW91dCh0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksdGltZW91dCk7XG4gICAgdGhpcy5sb2FkSW50ZXJuYWwoKTtcbiAgfVxuXG4gIGxvYWRJbnRlcm5hbCgpIHtcbiAgICB2YXIgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkID0gIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub25lcnJvciA9IHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vcGVuKCdHRVQnLCB0aGlzLnVybCAsIHRydWUpO1xuICAgIHhoci5yZXNwb25zZVR5cGUgPSB0aGlzLnJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLnN0YXRzLnRmaXJzdCA9IG51bGw7XG4gICAgdGhpcy5zdGF0cy5sb2FkZWQgPSAwO1xuICAgIHhoci5zZW5kKCk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICB0aGlzLnN0YXRzLnRsb2FkID0gbmV3IERhdGUoKTtcbiAgICB0aGlzLm9uU3VjY2VzcyhldmVudCx0aGlzLnN0YXRzKTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIGlmKHRoaXMuc3RhdHMucmV0cnkgPCB0aGlzLm1heFJldHJ5KSB7XG4gICAgICBsb2dnZXIud2FybihgJHtldmVudC50eXBlfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9LCByZXRyeWluZyBpbiAke3RoaXMucmV0cnlEZWxheX0uLi5gKTtcbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkSW50ZXJuYWwuYmluZCh0aGlzKSx0aGlzLnJldHJ5RGVsYXkpO1xuICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgdGhpcy5yZXRyeURlbGF5PU1hdGgubWluKDIqdGhpcy5yZXRyeURlbGF5LDY0MDAwKTtcbiAgICAgIHRoaXMuc3RhdHMucmV0cnkrKztcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgICAgbG9nZ2VyLmVycm9yKGAke2V2ZW50LnR5cGV9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgICB0aGlzLm9uRXJyb3IoZXZlbnQpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWR0aW1lb3V0KGV2ZW50KSB7XG4gICAgbG9nZ2VyLndhcm4oYHRpbWVvdXQgd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfWAgKTtcbiAgICB0aGlzLm9uVGltZW91dChldmVudCx0aGlzLnN0YXRzKTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcyhldmVudCkge1xuICAgIHZhciBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgaWYoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBuZXcgRGF0ZSgpO1xuICAgIH1cbiAgICBzdGF0cy5sb2FkZWQgPSBldmVudC5sb2FkZWQ7XG4gICAgaWYodGhpcy5vblByb2dyZXNzKSB7XG4gICAgICB0aGlzLm9uUHJvZ3Jlc3MoZXZlbnQsIHN0YXRzKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgWGhyTG9hZGVyO1xuIl19
