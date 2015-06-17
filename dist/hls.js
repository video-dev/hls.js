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

var _loaderFragmentLoader = require('../loader/fragment-loader');

var _loaderFragmentLoader2 = _interopRequireDefault(_loaderFragmentLoader);

var _observer = require('../observer');

var _observer2 = _interopRequireDefault(_observer);

var _utilsLogger = require('../utils/logger');

var _demuxDemuxer = require('../demux/demuxer');

var _demuxDemuxer2 = _interopRequireDefault(_demuxDemuxer);

var BufferController = (function () {
  function BufferController(levelController, config) {
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
    this.levelController = levelController;
    this.config = config;
    this.startPosition = 0;
    this.fragmentLoader = new _loaderFragmentLoader2['default'](config);
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
    this.onflt = this.onFragmentLoadTimeout.bind(this);
    this.onfle = this.onFragmentLoadError.bind(this);
    this.ontick = this.tick.bind(this);
    _observer2['default'].on(_events2['default'].MSE_ATTACHED, this.onmse);
    _observer2['default'].on(_events2['default'].MANIFEST_PARSED, this.onmp);
  }

  _createClass(BufferController, [{
    key: 'destroy',
    value: function destroy() {
      this.stop();
      this.fragmentLoader.destroy();
      _observer2['default'].removeListener(_events2['default'].MANIFEST_PARSED, this.onmp);
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
    key: 'start',
    value: function start() {
      this.startInternal();
      if (this.lastCurrentTime) {
        _utilsLogger.logger.log('resuming video @ ' + this.lastCurrentTime);
        this.startPosition = this.lastCurrentTime;
        this.state = this.IDLE;
      } else {
        this.state = this.STARTING;
      }
      this.tick();
    }
  }, {
    key: 'startInternal',
    value: function startInternal() {
      this.stop();
      this.demuxer = new _demuxDemuxer2['default'](this.config);
      this.timer = setInterval(this.ontick, 100);
      this.appendError = 0;
      _observer2['default'].on(_events2['default'].FRAG_LOADED, this.onfl);
      _observer2['default'].on(_events2['default'].FRAG_PARSING_INIT_SEGMENT, this.onis);
      _observer2['default'].on(_events2['default'].FRAG_PARSING_DATA, this.onfpg);
      _observer2['default'].on(_events2['default'].FRAG_PARSED, this.onfp);
      _observer2['default'].on(_events2['default'].FRAG_LOAD_ERROR, this.onfle);
      _observer2['default'].on(_events2['default'].FRAG_LOAD_TIMEOUT, this.onflt);
      _observer2['default'].on(_events2['default'].LEVEL_LOADED, this.onll);
    }
  }, {
    key: 'stop',
    value: function stop() {
      this.mp4segments = [];
      this.flushRange = [];
      this.bufferRange = [];
      this.frag = null;
      this.fragmentLoader.abort();
      this.flushBufferCounter = 0;
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
      _observer2['default'].removeListener(_events2['default'].FRAG_LOADED, this.onfl);
      _observer2['default'].removeListener(_events2['default'].FRAG_PARSED, this.onfp);
      _observer2['default'].removeListener(_events2['default'].FRAG_PARSING_DATA, this.onfpg);
      _observer2['default'].removeListener(_events2['default'].LEVEL_LOADED, this.onll);
      _observer2['default'].removeListener(_events2['default'].FRAG_PARSING_INIT_SEGMENT, this.onis);
      _observer2['default'].removeListener(_events2['default'].FRAG_LOAD_ERROR, this.onfle);
      _observer2['default'].removeListener(_events2['default'].FRAG_LOAD_TIMEOUT, this.onflt);
    }
  }, {
    key: 'tick',
    value: function tick() {
      var pos, level, levelInfo, fragIdx;
      switch (this.state) {
        case this.ERROR:
          //don't do anything in error state to avoid breaking further ...
          break;
        case this.STARTING:
          // determine load level
          this.startLevel = this.levelController.startLevel;
          if (this.startLevel === -1) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            this.startLevel = 0;
            this.fragmentBitrateTest = true;
          }
          // set new level to playlist loader : this will trigger start level load
          this.levelController.level = this.startLevel;
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
          if (this.startFragmentLoaded === false) {
            level = this.startLevel;
          } else {
            // we are not at playback start, get next load level from level Controller
            level = this.levelController.nextLevel();
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
            if (level !== this.level) {
              // set new level to playlist loader : this will trigger a playlist load if needed
              this.levelController.level = level;
              // tell demuxer that we will switch level (this will force init segment to be regenerated)
              if (this.demuxer) {
                this.demuxer.switchLevel();
              }
            }
            levelInfo = this.levels[level].details;
            // if level info not retrieved yet, switch state and wait for level retrieval
            if (typeof levelInfo === 'undefined') {
              this.state = this.WAITING_LEVEL;
              break;
            }
            // find fragment index, contiguous with end of buffer position
            var fragments = levelInfo.fragments,
                frag,
                sliding = levelInfo.sliding,
                start = fragments[0].start + sliding;
            // check if requested position is within seekable boundaries :
            // in case of live playlist we need to ensure that requested position is not located before playlist start
            //logger.log(`start/pos/bufEnd/seeking:${start.toFixed(3)}/${pos.toFixed(3)}/${bufferEnd.toFixed(3)}/${this.video.seeking}`);
            if (bufferEnd < start) {
              this.seekAfterStalling = this.startPosition + sliding;
              _utilsLogger.logger.log('buffer end: ' + bufferEnd + ' is located before start of live sliding playlist, media position will be reseted to: ' + this.seekAfterStalling.toFixed(3));
              bufferEnd = this.seekAfterStalling;
            }
            //look for fragments matching with current play position
            for (fragIdx = 0; fragIdx < fragments.length; fragIdx++) {
              frag = fragments[fragIdx];
              start = frag.start + sliding;
              //logger.log(`level/sn/sliding/start/end/bufEnd:${level}/${frag.sn}/${sliding}/${start}/${start+frag.duration}/${bufferEnd}`);
              // offset should be within fragment boundary
              if (start <= bufferEnd && start + frag.duration > bufferEnd) {
                break;
              }
            }
            if (fragIdx >= 0 && fragIdx < fragments.length) {
              //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
              if (this.frag && frag.sn === this.frag.sn) {
                if (fragIdx === fragments.length - 1) {
                  // we are at the end of the playlist and we already loaded last fragment, don't do anything
                  break;
                } else {
                  frag = fragments[fragIdx + 1];
                  _utilsLogger.logger.log('SN just loaded, load next one: ' + frag.sn);
                }
              }
              _utilsLogger.logger.log('Loading       ' + frag.sn + ' of [' + fragments[0].sn + ' ,' + fragments[fragments.length - 1].sn + '],level ' + level);
              //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));

              this.frag = frag;
              this.level = level;
              this.fragmentLoader.load(frag);
              this.state = this.LOADING;
            }
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
        // nothing to do, wait for fragment retrieval
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
                _utilsLogger.logger.log('error while trying to append buffer:' + err.message + ',try appending later');
                this.mp4segments.unshift(segment);
                this.appendError++;
                if (this.appendError > 3) {
                  _utilsLogger.logger.log('fail 3 times to append segment in sourceBuffer');
                  _observer2['default'].trigger(_events2['default'].FRAG_APPENDING_ERROR, { frag: this.frag });
                  this.state = this.ERROR;
                  return;
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
              // reset flush counter
              this.flushBufferCounter = 0;
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
        }
      }

      if (rangeCurrent) {
        if (rangeCurrent.frag !== this.fragCurrent) {
          this.fragCurrent = rangeCurrent.frag;
          _observer2['default'].trigger(_events2['default'].FRAG_CHANGED, { frag: this.fragCurrent });
          // if(this.fragCurrent.fpsExpected) {
          //   this.fragCurrent.decodedFramesDate = Date.now();
          //   this.fragCurrent.decodedFramesNb = this.video.webkitDecodedFrameCount;
          //   logger.log(`frag changed, expected FPS:${this.fragCurrent.fpsExpected.toFixed(2)}`);
          // }
        } /* else {
           if(this.fragCurrent.fpsExpected) {
             // compare real fps vs theoritical one
             var nbnew = this.video.webkitDecodedFrameCount;
             var time = Date.now();
             if((time - this.fragCurrent.decodedFramesDate) > 2000) {
               var fps = 1000*(nbnew - this.fragCurrent.decodedFramesNb)/(time-this.fragCurrent.decodedFramesDate);
               logger.log(`real/expected FPS:${fps.toFixed(2)}/${this.fragCurrent.fpsExpected.toFixed(2)}`);
             }
           }
          } */
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
      if (!this.immediateSwitch) {
        this.immediateSwitch = true;
        this.previouslyPaused = this.video.paused;
        this.video.pause();
      }
      this.fragmentLoader.abort();
      // flush everything
      this.flushRange.push({ start: 0, end: Number.POSITIVE_INFINITY });
      // trigger a sourceBuffer flush
      this.state = this.BUFFER_FLUSHING;
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
        fetchdelay = this.levelController.nextFetchDuration() + 1;
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
        // trigger a sourceBuffer flush
        this.state = this.BUFFER_FLUSHING;
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
      if (this.levels) {
        this.start();
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
          this.fragmentLoader.abort();
          this.frag = null;
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
      this.audiocodecswitch = data.audiocodecswitch;
      if (this.audiocodecswitch) {
        _utilsLogger.logger.log('both AAC/HE-AAC audio found in levels; declaring audio codec as HE-AAC');
      }
      this.levels = data.levels;
      this.startLevelLoaded = false;
      this.startFragmentLoaded = false;
      if (this.video) {
        this.start();
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(event, data) {
      var fragments = data.details.fragments,
          duration = data.details.totalduration;
      _utilsLogger.logger.log('level ' + data.levelId + ' loaded [' + fragments[0].sn + ',' + fragments[fragments.length - 1].sn + '],duration:' + duration);

      var level = this.levels[data.levelId],
          sliding = 0,
          levelCurrent = this.levels[this.level];
      // check if playlist is already loaded (if yes, it should be a live playlist)
      if (levelCurrent && levelCurrent.details && levelCurrent.details.live) {
        var oldfragments = levelCurrent.details.fragments;
        //  playlist sliding is the sum of : current playlist sliding + sliding of new playlist compared to current one
        sliding = levelCurrent.details.sliding;
        // check sliding of updated playlist against current one :
        // and find its position in current playlist
        //logger.log("fragments[0].sn/this.level/levelCurrent.details.fragments[0].sn:" + fragments[0].sn + "/" + this.level + "/" + levelCurrent.details.fragments[0].sn);
        var SNdiff = fragments[0].sn - oldfragments[0].sn;
        if (SNdiff >= 0) {
          // positive sliding : new playlist sliding window is after previous one
          if (SNdiff < oldfragments.length) {
            sliding += oldfragments[SNdiff].start;
          } else {
            _utilsLogger.logger.log('cannot compute sliding, no SN in common between old/new level:[' + oldfragments[0].sn + ',' + oldfragments[oldfragments.length - 1].sn + ']/[' + fragments[0].sn + ',' + fragments[fragments.length - 1].sn + ']');
          }
        } else {
          // negative sliding: new playlist sliding window is before previous one
          sliding -= fragments[-SNdiff].start;
        }
        _utilsLogger.logger.log('live playlist sliding:' + sliding.toFixed(3));
      }
      // override level info
      level.details = data.details;
      level.details.sliding = sliding;
      this.demuxer.setDuration(duration + sliding);
      if (this.startLevelLoaded === false) {
        // if live playlist, set start position to be fragment N-3
        if (data.details.live) {
          this.startPosition = Math.max(0, duration - 3 * data.details.targetduration);
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
              duration = details.totalduration;
          if (details.live) {
            duration += details.sliding;
          }
          this.demuxer.setDuration(duration);
          this.demuxer.push(data.payload, currentLevel.audioCodec, currentLevel.videoCodec, this.frag.start);
        }
        this.startFragmentLoaded = true;
      }
    }
  }, {
    key: 'onInitSegment',
    value: function onInitSegment(event, data) {
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

      // codec="mp4a.40.5,avc1.420016";
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
  }, {
    key: 'onFragmentParsing',
    value: function onFragmentParsing(event, data) {
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
      this.mp4segments.push({ type: data.type, data: data.moof });
      this.mp4segments.push({ type: data.type, data: data.mdat });
      this.nextLoadPosition = data.endPTS;
      this.bufferRange.push({ type: data.type, start: data.startPTS, end: data.endPTS, frag: this.frag });
      // if(data.type === 'video') {
      //   this.frag.fpsExpected = (data.nb-1) / (data.endPTS - data.startPTS);
      // }
      //trigger handler right now
      this.tick();
    }
  }, {
    key: 'onFragmentParsed',
    value: function onFragmentParsed() {
      this.state = this.PARSED;
      this.stats.tparsed = new Date();
      //trigger handler right now
      this.tick();
    }
  }, {
    key: 'onFragmentLoadError',
    value: function onFragmentLoadError() {
      _utilsLogger.logger.log('buffer controller: error while loading frag, retry ...');
      this.fragmentLoader.abort();
      this.state = this.IDLE;
      this.frag = null;
    }
  }, {
    key: 'onFragmentLoadTimeout',
    value: function onFragmentLoadTimeout() {
      _utilsLogger.logger.log('buffer controller: timeout while loading frag, retry ...');
      this.fragmentLoader.abort();
      this.state = this.IDLE;
      this.frag = null;
    }
  }, {
    key: 'onSourceBufferUpdateEnd',
    value: function onSourceBufferUpdateEnd() {
      //trigger handler right now
      if (this.state === this.APPENDING && this.mp4segments.length === 0) {
        this.stats.tbuffered = new Date();
        _observer2['default'].trigger(_events2['default'].FRAG_BUFFERED, { stats: this.stats, frag: this.frag });
        this.state = this.IDLE;
      }
      this.tick();
    }
  }, {
    key: 'onSourceBufferError',
    value: function onSourceBufferError(event) {
      _utilsLogger.logger.log('sourceBuffer error:' + event);
      this.state = this.ERROR;
      _observer2['default'].trigger(_events2['default'].FRAG_APPENDING_ERROR, { frag: this.frag });
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

},{"../demux/demuxer":5,"../events":9,"../loader/fragment-loader":11,"../observer":13,"../utils/logger":16}],4:[function(require,module,exports){
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

var LevelController = (function () {
  function LevelController(playlistLoader) {
    _classCallCheck(this, LevelController);

    this.playlistLoader = playlistLoader;
    this.onml = this.onManifestLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onfle = this.onFragmentLoadError.bind(this);
    this.onflt = this.onFragmentLoadTimeout.bind(this);
    this.onllt = this.onLevelLoadTimeout.bind(this);
    this.onlle = this.onLevelLoadError.bind(this);
    this.ontick = this.tick.bind(this);
    _observer2['default'].on(_events2['default'].MANIFEST_LOADED, this.onml);
    _observer2['default'].on(_events2['default'].FRAG_LOADED, this.onfl);
    _observer2['default'].on(_events2['default'].FRAG_LOAD_ERROR, this.onfle);
    _observer2['default'].on(_events2['default'].FRAG_LOAD_TIMEOUT, this.onflt);
    _observer2['default'].on(_events2['default'].LEVEL_LOADED, this.onll);
    _observer2['default'].on(_events2['default'].LEVEL_LOAD_ERROR, this.onlle);
    _observer2['default'].on(_events2['default'].LEVEL_LOAD_TIMEOUT, this.onllt);
    this._manualLevel = this._autoLevelCapping = -1;
    //this.startLevel = startLevel;
  }

  _createClass(LevelController, [{
    key: 'destroy',
    value: function destroy() {
      _observer2['default'].removeListener(_events2['default'].MANIFEST_LOADED, this.onml);
      _observer2['default'].removeListener(_events2['default'].FRAG_LOADED, this.onfl);
      _observer2['default'].removeListener(_events2['default'].FRAG_LOAD_ERROR, this.onfle);
      _observer2['default'].removeListener(_events2['default'].FRAG_LOAD_TIMEOUT, this.onflt);
      _observer2['default'].removeListener(_events2['default'].LEVEL_LOADED, this.onll);
      _observer2['default'].removeListener(_events2['default'].LEVEL_LOAD_ERROR, this.onlle);
      _observer2['default'].removeListener(_events2['default'].LEVEL_LOAD_TIMEOUT, this.onllt);
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
          bitrateSet = {},
          aac = false,
          heaac = false,
          codecs;
      if (data.levels.length > 1) {
        // remove failover level for now to simplify the logic
        data.levels.forEach(function (level) {
          if (!bitrateSet.hasOwnProperty(level.bitrate)) {
            levels.push(level);
            bitrateSet[level.bitrate] = true;
          }
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

        //this._startLevel = -1;
        _observer2['default'].trigger(_events2['default'].MANIFEST_PARSED, { levels: this._levels,
          startLevel: this._startLevel,
          audiocodecswitch: aac && heaac
        });
      } else {
        this._levels = data.levels;
        this._firstLevel = 0;
        _observer2['default'].trigger(_events2['default'].MANIFEST_PARSED, { levels: this._levels,
          startLevel: 0,
          audiocodecswitch: false
        });
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
        _observer2['default'].trigger(_events2['default'].LEVEL_SWITCH, { levelId: newLevel });
        var level = this._levels[newLevel];
        // check if we need to load playlist for this level
        if (level.loading === undefined || level.details && level.details.live === true) {
          // level not retrieved yet, or live playlist we need to (re)load it
          _observer2['default'].trigger(_events2['default'].LEVEL_LOADING, { levelId: newLevel });
          _utilsLogger.logger.log('(re)loading playlist for level ' + newLevel);
          this.playlistLoader.load(level.url, newLevel);
          level.loading = true;
        }
      } else {
        // invalid level id given, trigger error
        _observer2['default'].trigger(_events2['default'].LEVEL_ERROR, { level: newLevel, event: 'invalid level idx' });
      }
    }
  }, {
    key: 'onFragmentLoaded',
    value: function onFragmentLoaded(event, data) {
      var stats = data.stats;
      this.lastfetchduration = (stats.tload - stats.trequest) / 1000;
      this.lastfetchlevel = data.frag.level;
      this.lastbw = stats.length * 8 / this.lastfetchduration;
      //console.log(`len:${stats.length},fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}`);
    }
  }, {
    key: 'onFragmentLoadError',
    value: function onFragmentLoadError() {
      _utilsLogger.logger.log('level controller,frag load error: emergency switch-down for next fragment');
      this.lastbw = 0;
      this.lastfetchduration = 0;
    }
  }, {
    key: 'onFragmentLoadTimeout',
    value: function onFragmentLoadTimeout() {
      _utilsLogger.logger.log('level controller,frag load timeout: emergency switch-down for next fragment');
      this.lastbw = 0;
      this.lastfetchduration = 0;
    }
  }, {
    key: 'onLevelLoadError',
    value: function onLevelLoadError() {
      _utilsLogger.logger.log('level controller,level load error: try to reload same level');
      this._levels[this._level].loading = undefined;
      this.playlistLoader.abort();
      this.setLevelInternal(this._level);
    }
  }, {
    key: 'onLevelLoadTimeout',
    value: function onLevelLoadTimeout() {
      _utilsLogger.logger.log('level controller,level load timeout: try to reload same level');
      this._levels[this._level].loading = undefined;
      this.playlistLoader.abort();
      this.setLevelInternal(this._level);
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
      _observer2['default'].trigger(_events2['default'].LEVEL_LOADING, { levelId: this._level });
      this.playlistLoader.load(this._levels[this._level].url, this._level);
    }
  }, {
    key: 'nextLevel',
    value: function nextLevel() {
      if (this._manualLevel !== -1) {
        return this._manualLevel;
      } else {
        return this.nextAutoLevel();
      }
    }
  }, {
    key: 'nextFetchDuration',
    value: function nextFetchDuration() {
      if (this.lastfetchduration) {
        return this.lastfetchduration * this._levels[this._level].bitrate / this._levels[this.lastfetchlevel].bitrate;
      } else {
        return 0;
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
      if (this._level !== newLevel) {
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
      this.level = newLevel;
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

},{"../events":9,"../observer":13,"../utils/logger":16}],5:[function(require,module,exports){
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
        _utilsLogger.logger.log('error while initializing TSDemuxerWorker, fallback on regular TSDemuxer');
        this.demuxer = new _tsdemuxer2['default']();
      }
    } else {
      this.demuxer = new _tsdemuxer2['default']();
    }
    this.demuxInitialized = true;
  }

  _createClass(Demuxer, [{
    key: 'setDuration',
    value: function setDuration(newDuration) {
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'duration', data: newDuration });
      } else {
        this.demuxer.setDuration(newDuration);
      }
    }
  }, {
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
    value: function push(data, audioCodec, videoCodec, timeOffset) {
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset }, [data]);
      } else {
        this.demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset);
        this.demuxer.end();
      }
    }
  }, {
    key: 'switchLevel',
    value: function switchLevel() {
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'switchLevel' });
      } else {
        this.demuxer.switchLevel();
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
        case _events2['default'].FRAG_PARSED:
          _observer2['default'].trigger(_events2['default'].FRAG_PARSED);
          break;
        default:
          break;
      }
    }
  }]);

  return Demuxer;
})();

exports['default'] = Demuxer;
module.exports = exports['default'];

},{"../events":9,"../observer":13,"../utils/logger":16,"./tsdemuxer":7,"./tsdemuxerworker":8,"webworkify":2}],6:[function(require,module,exports){
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
  function ExpGolomb(workingData) {
    _classCallCheck(this, ExpGolomb);

    this.workingData = workingData;
    // the number of bytes left to examine in this.workingData
    this.workingBytesAvailable = this.workingData.byteLength;
    // the current word being examined
    this.workingWord = 0; // :uint
    // the number of bits left to examine in the current word
    this.workingBitsAvailable = 0; // :uint
  }

  _createClass(ExpGolomb, [{
    key: 'loadWord',

    // ():void
    value: function loadWord() {
      var position = this.workingData.byteLength - this.workingBytesAvailable,
          workingBytes = new Uint8Array(4),
          availableBytes = Math.min(4, this.workingBytesAvailable);

      if (availableBytes === 0) {
        throw new Error('no bytes available');
      }

      workingBytes.set(this.workingData.subarray(position, position + availableBytes));
      this.workingWord = new DataView(workingBytes.buffer).getUint32(0);

      // track the amount of this.workingData that has been processed
      this.workingBitsAvailable = availableBytes * 8;
      this.workingBytesAvailable -= availableBytes;
    }
  }, {
    key: 'skipBits',

    // (count:int):void
    value: function skipBits(count) {
      var skipBytes; // :int
      if (this.workingBitsAvailable > count) {
        this.workingWord <<= count;
        this.workingBitsAvailable -= count;
      } else {
        count -= this.workingBitsAvailable;
        skipBytes = count >> 3;

        count -= skipBytes >> 3;
        this.workingBytesAvailable -= skipBytes;

        this.loadWord();

        this.workingWord <<= count;
        this.workingBitsAvailable -= count;
      }
    }
  }, {
    key: 'readBits',

    // (size:int):uint
    value: function readBits(size) {
      var bits = Math.min(this.workingBitsAvailable, size),
          // :uint
      valu = this.workingWord >>> 32 - bits; // :uint

      if (size > 32) {
        _utilsLogger.logger.error('Cannot read more than 32 bits at a time');
      }

      this.workingBitsAvailable -= bits;
      if (this.workingBitsAvailable > 0) {
        this.workingWord <<= bits;
      } else if (this.workingBytesAvailable > 0) {
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
    key: 'skipLeadingZeros',

    // ():uint
    value: function skipLeadingZeros() {
      var leadingZeroCount; // :uint
      for (leadingZeroCount = 0; leadingZeroCount < this.workingBitsAvailable; ++leadingZeroCount) {
        if (0 !== (this.workingWord & 2147483648 >>> leadingZeroCount)) {
          // the first bit of working word is 1
          this.workingWord <<= leadingZeroCount;
          this.workingBitsAvailable -= leadingZeroCount;
          return leadingZeroCount;
        }
      }

      // we exhausted workingWord and still have not found a 1
      this.loadWord();
      return leadingZeroCount + this.skipLeadingZeros();
    }
  }, {
    key: 'skipUnsignedExpGolomb',

    // ():void
    value: function skipUnsignedExpGolomb() {
      this.skipBits(1 + this.skipLeadingZeros());
    }
  }, {
    key: 'skipExpGolomb',

    // ():void
    value: function skipExpGolomb() {
      this.skipBits(1 + this.skipLeadingZeros());
    }
  }, {
    key: 'readUnsignedExpGolomb',

    // ():uint
    value: function readUnsignedExpGolomb() {
      var clz = this.skipLeadingZeros(); // :uint
      return this.readBits(clz + 1) - 1;
    }
  }, {
    key: 'readExpGolomb',

    // ():int
    value: function readExpGolomb() {
      var valu = this.readUnsignedExpGolomb(); // :int
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
    key: 'readUnsignedByte',

    // ():int
    value: function readUnsignedByte() {
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
          deltaScale = this.readExpGolomb();
          nextScale = (lastScale + deltaScale + 256) % 256;
        }

        lastScale = nextScale === 0 ? lastScale : nextScale;
      }
    }
  }, {
    key: 'readSequenceParameterSet',

    /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
     * @param data {Uint8Array} the bytes of a sequence parameter set
     * @return {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */
    value: function readSequenceParameterSet() {
      var frameCropLeftOffset = 0,
          frameCropRightOffset = 0,
          frameCropTopOffset = 0,
          frameCropBottomOffset = 0,
          profileIdc,
          profileCompatibility,
          levelIdc,
          numRefFramesInPicOrderCntCycle,
          picWidthInMbsMinus1,
          picHeightInMapUnitsMinus1,
          frameMbsOnlyFlag,
          scalingListCount,
          i;

      this.readUnsignedByte();
      profileIdc = this.readUnsignedByte(); // profile_idc
      profileCompatibility = this.readBits(5); // constraint_set[0-4]_flag, u(5)
      this.skipBits(3); // reserved_zero_3bits u(3),
      levelIdc = this.readUnsignedByte(); //level_idc u(8)
      this.skipUnsignedExpGolomb(); // seq_parameter_set_id

      // some profiles have more optional data we don't need
      if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 144) {
        var chromaFormatIdc = this.readUnsignedExpGolomb();
        if (chromaFormatIdc === 3) {
          this.skipBits(1); // separate_colour_plane_flag
        }
        this.skipUnsignedExpGolomb(); // bit_depth_luma_minus8
        this.skipUnsignedExpGolomb(); // bit_depth_chroma_minus8
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

      this.skipUnsignedExpGolomb(); // log2_max_frame_num_minus4
      var picOrderCntType = this.readUnsignedExpGolomb();

      if (picOrderCntType === 0) {
        this.readUnsignedExpGolomb(); //log2_max_pic_order_cnt_lsb_minus4
      } else if (picOrderCntType === 1) {
        this.skipBits(1); // delta_pic_order_always_zero_flag
        this.skipExpGolomb(); // offset_for_non_ref_pic
        this.skipExpGolomb(); // offset_for_top_to_bottom_field
        numRefFramesInPicOrderCntCycle = this.readUnsignedExpGolomb();
        for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
          this.skipExpGolomb(); // offset_for_ref_frame[ i ]
        }
      }

      this.skipUnsignedExpGolomb(); // max_num_ref_frames
      this.skipBits(1); // gaps_in_frame_num_value_allowed_flag

      picWidthInMbsMinus1 = this.readUnsignedExpGolomb();
      picHeightInMapUnitsMinus1 = this.readUnsignedExpGolomb();

      frameMbsOnlyFlag = this.readBits(1);
      if (frameMbsOnlyFlag === 0) {
        this.skipBits(1); // mb_adaptive_frame_field_flag
      }

      this.skipBits(1); // direct_8x8_inference_flag
      if (this.readBoolean()) {
        // frame_cropping_flag
        frameCropLeftOffset = this.readUnsignedExpGolomb();
        frameCropRightOffset = this.readUnsignedExpGolomb();
        frameCropTopOffset = this.readUnsignedExpGolomb();
        frameCropBottomOffset = this.readUnsignedExpGolomb();
      }

      return {
        profileIdc: profileIdc,
        profileCompatibility: profileCompatibility,
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

},{"../utils/logger":16}],7:[function(require,module,exports){
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

// import MP4Inspect      from '../remux/mp4-inspector';

var _observer = require('../observer');

var _observer2 = _interopRequireDefault(_observer);

var _utilsLogger = require('../utils/logger');

var TSDemuxer = (function () {
  function TSDemuxer() {
    _classCallCheck(this, TSDemuxer);

    this.switchLevel();
  }

  _createClass(TSDemuxer, [{
    key: 'setDuration',
    value: function setDuration(newDuration) {
      this._duration = newDuration;
    }
  }, {
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
    key: 'push',

    // feed incoming data to the front of the parsing pipeline
    value: function push(data, audioCodec, videoCodec, timeOffset) {
      this.audioCodec = audioCodec;
      this.videoCodec = videoCodec;
      this.timeOffset = timeOffset;
      var offset;
      for (offset = 0; offset < data.length; offset += 188) {
        this._parseTSPacket(data, offset);
      }
    }
  }, {
    key: 'end',

    // flush any buffered data
    value: function end() {
      if (this._avcData) {
        this._parseAVCPES(this._parsePES(this._avcData));
        this._avcData = null;
      }
      //logger.log('nb AVC samples:' + this._avcSamples.length);
      if (this._avcSamples.length) {
        this._flushAVCSamples();
      }
      if (this._aacData) {
        this._parseAACPES(this._parsePES(this._aacData));
        this._aacData = null;
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
    key: '_parseTSPacket',
    value: function _parseTSPacket(data, start) {
      var stt, pid, atf, offset;
      if (data[start] === 71) {
        stt = !!(data[start + 1] & 64);
        // pid is a 13-bit field starting at the last bit of TS[1]
        pid = ((data[start + 1] & 31) << 8) + data[start + 2];
        atf = (data[start + 3] & 48) >> 4;
        // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
        if (atf > 1) {
          offset = start + 5 + data[start + 4];
          // return if there is only adaptation field
          if (offset === start + 188) {
            return;
          }
        } else {
          offset = start + 4;
        }
        if (this.pmtParsed) {
          if (pid === this._avcId) {
            if (stt) {
              if (this._avcData) {
                this._parseAVCPES(this._parsePES(this._avcData));
              }
              this._avcData = { data: [], size: 0 };
            }
            this._avcData.data.push(data.subarray(offset, start + 188));
            this._avcData.size += start + 188 - offset;
          } else if (pid === this._aacId) {
            if (stt) {
              if (this._aacData) {
                this._parseAACPES(this._parsePES(this._aacData));
              }
              this._aacData = { data: [], size: 0 };
            }
            this._aacData.data.push(data.subarray(offset, start + 188));
            this._aacData.size += start + 188 - offset;
          }
        } else {
          if (stt) {
            offset += data[offset] + 1;
          }
          if (pid === 0) {
            this._parsePAT(data, offset);
          } else if (pid === this._pmtId) {
            this._parsePMT(data, offset);
            this.pmtParsed = true;
          }
        }
      } else {
        _utilsLogger.logger.log('parsing error');
      }
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
          // PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
          pesPts = (frag[9] & 14) << 29 | (frag[10] & 255) << 22 | (frag[11] & 254) << 14 | (frag[12] & 255) << 7 | (frag[13] & 254) >>> 1;
          if (pesFlags & 64) {
            pesDts = (frag[14] & 14) << 29 | (frag[15] & 255) << 22 | (frag[16] & 254) << 14 | (frag[17] & 255) << 7 | (frag[18] & 254) >>> 1;
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
              var config = expGolombDecoder.readSequenceParameterSet();
              track.width = config.width;
              track.height = config.height;
              track.profileIdc = config.profileIdc;
              track.profileCompatibility = config.profileCompatibility;
              track.levelIdc = config.levelIdc;
              track.sps = [unit.data];
              track.duration = 90000 * _this._duration;
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
      // generate Init Segment if needed
      if (!this._initSegGenerated) {
        this._generateInitSegment();
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

        avcSample.pts -= this._initDTS;
        avcSample.dts -= this._initDTS;
        //logger.log('Video/PTS/DTS:' + avcSample.pts + '/' + avcSample.dts);

        if (lastSampleDTS !== undefined) {
          mp4Sample.duration = avcSample.dts - lastSampleDTS;
          if (mp4Sample.duration < 0) {
            //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
            mp4Sample.duration = 0;
          }
        } else {
          // check if fragments are contiguous (i.e. no missing frames between fragment)
          if (this.nextAvcPts) {
            var delta = (avcSample.pts - this.nextAvcPts) / 90,
                absdelta = Math.abs(delta);
            //logger.log('absdelta/avcSample.pts:' + absdelta + '/' + avcSample.pts);
            // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
            if (absdelta < 300) {
              //logger.log('Video next PTS:' + this.nextAvcPts);
              if (delta > 1) {
                _utilsLogger.logger.log('AVC:' + delta.toFixed(0) + ' ms hole between fragments detected,filling it');
              } else if (delta < -1) {
                _utilsLogger.logger.log('AVC:' + -delta.toFixed(0) + ' ms overlapping between fragments detected');
              }
              // set PTS to next PTS
              avcSample.pts = this.nextAvcPts;
              // offset DTS as well, ensure that DTS is smaller or equal than new PTS
              avcSample.dts = Math.max(avcSample.dts - delta, this.lastAvcDts);
              // logger.log('Video/PTS/DTS adjusted:' + avcSample.pts + '/' + avcSample.dts);
            }
          }
          // remember first PTS of our avcSamples, ensure value is positive
          firstPTS = Math.max(0, avcSample.pts);
          firstDTS = Math.max(0, avcSample.dts);
        }

        mp4Sample = {
          size: mp4SampleLength,
          compositionTimeOffset: avcSample.pts - avcSample.dts,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradationPriority: 0
          }
        };

        if (avcSample.key === true) {
          // the current sample is a key frame
          mp4Sample.flags.dependsOn = 2;
          mp4Sample.flags.isNonSyncSample = 0;
        } else {
          mp4Sample.flags.dependsOn = 1;
          mp4Sample.flags.isNonSyncSample = 1;
        }
        samples.push(mp4Sample);
        lastSampleDTS = avcSample.dts;
      }
      mp4Sample.duration = samples[samples.length - 2].duration;
      this.lastAvcDts = avcSample.dts;
      // next AVC sample PTS should be equal to last sample PTS + duration
      this.nextAvcPts = avcSample.pts + mp4Sample.duration;
      //logger.log('Video/lastAvcDts/nextAvcPts:' + this.lastAvcDts + '/' + this.nextAvcPts);

      this._avcSamplesLength = 0;
      this._avcSamplesNbNalu = 0;

      track.samples = samples;
      moof = _remuxMp4Generator2['default'].moof(track.sequenceNumber++, firstDTS, track);
      track.samples = [];
      _observer2['default'].trigger(_events2['default'].FRAG_PARSING_DATA, {
        moof: moof,
        mdat: mdat,
        startPTS: firstPTS / 90000,
        endPTS: this.nextAvcPts / 90000,
        startDTS: firstDTS / 90000,
        endDTS: (avcSample.dts + mp4Sample.duration) / 90000,
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
          i;
      if (this.aacOverFlow) {
        var tmp = new Uint8Array(this.aacOverFlow.byteLength + data.byteLength);
        tmp.set(this.aacOverFlow, 0);
        tmp.set(data, this.aacOverFlow.byteLength);
        data = tmp;
      }
      //logger.log('PES:' + Hex.hexDump(data));
      if (data[0] === 255) {
        if (!track.audiosamplerate) {
          config = this._ADTStoAudioConfig(pes.data, this.audioCodec);
          track.config = config.config;
          track.audiosamplerate = config.samplerate;
          track.channelCount = config.channelCount;
          track.codec = config.codec;
          track.duration = 90000 * this._duration;
          console.log('parsed   codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
        }
        adtsStartOffset = i = 0;
        while (adtsStartOffset + 5 < data.length) {
          // retrieve frame size
          adtsFrameSize = (data[adtsStartOffset + 3] & 3) << 11;
          // byte 4
          adtsFrameSize |= data[adtsStartOffset + 4] << 3;
          // byte 5
          adtsFrameSize |= (data[adtsStartOffset + 5] & 224) >>> 5;
          adtsHeaderLen = !!(data[adtsStartOffset + 1] & 1) ? 7 : 9;
          adtsFrameSize -= adtsHeaderLen;
          stamp = pes.pts + i * 1024 * 90000 / track.audiosamplerate;
          //stamp = pes.pts;
          //console.log('AAC frame, offset/length/pts:' + (adtsStartOffset+7) + '/' + adtsFrameSize + '/' + stamp.toFixed(0));
          if (adtsStartOffset + adtsHeaderLen + adtsFrameSize <= data.length) {
            aacSample = { unit: data.subarray(adtsStartOffset + adtsHeaderLen, adtsStartOffset + adtsHeaderLen + adtsFrameSize), pts: stamp, dts: stamp };
            this._aacSamples.push(aacSample);
            this._aacSamplesLength += adtsFrameSize;
            adtsStartOffset += adtsFrameSize + adtsHeaderLen;
            i++;
          } else {
            break;
          }
        }
      } else {
        _observer2['default'].trigger(_events2['default'].FRAG_PARSING_ERROR, 'Stream did not start with ADTS header.');
        return;
      }
      if (!this._initSegGenerated) {
        this._generateInitSegment();
      }
      if (adtsStartOffset < data.length) {
        this.aacOverFlow = data.subarray(adtsStartOffset, data.length);
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

        aacSample.pts -= this._initDTS;
        aacSample.dts -= this._initDTS;

        //logger.log('Audio/PTS:' + aacSample.pts.toFixed(0));
        if (lastSampleDTS !== undefined) {
          // we use DTS to compute sample duration, but we use PTS to compute initPTS which is used to sync audio and video
          mp4Sample.duration = aacSample.dts - lastSampleDTS;
          if (mp4Sample.duration < 0) {
            //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
            mp4Sample.duration = 0;
          }
        } else {
          // check if fragments are contiguous (i.e. no missing frames between fragment)
          if (this.nextAacPts && this.nextAacPts !== aacSample.pts) {
            //logger.log('Audio next PTS:' + this.nextAacPts);
            var delta = (aacSample.pts - this.nextAacPts) / 90;
            // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
            if (Math.abs(delta) > 1 && Math.abs(delta) < 300) {
              if (delta > 0) {
                _utilsLogger.logger.log('AAC:' + delta.toFixed(0) + ' ms hole between fragments detected,filling it');
                // set PTS to next PTS, and ensure PTS is greater or equal than last DTS
                aacSample.pts = Math.max(this.nextAacPts, this.lastAacDts);
                aacSample.dts = aacSample.pts;
                //logger.log('Audio/PTS/DTS adjusted:' + aacSample.pts + '/' + aacSample.dts);
              } else {
                _utilsLogger.logger.log('AAC:' + -delta.toFixed(0) + ' ms overlapping between fragments detected');
              }
            }
          }
          // remember first PTS of our aacSamples, ensure value is positive
          firstPTS = Math.max(0, aacSample.pts);
          firstDTS = Math.max(0, aacSample.dts);
        }

        mp4Sample = {
          size: unit.byteLength,
          compositionTimeOffset: 0,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradationPriority: 0,
            dependsOn: 1
          }
        };
        samples.push(mp4Sample);
        lastSampleDTS = aacSample.dts;
      }
      //set last sample duration as being identical to previous sample
      mp4Sample.duration = samples[samples.length - 2].duration;
      this.lastAacDts = aacSample.dts;
      // next aac sample PTS should be equal to last sample PTS + duration
      this.nextAacPts = aacSample.pts + mp4Sample.duration;
      //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));

      this._aacSamplesLength = 0;
      track.samples = samples;
      moof = _remuxMp4Generator2['default'].moof(track.sequenceNumber++, firstDTS, track);
      track.samples = [];
      _observer2['default'].trigger(_events2['default'].FRAG_PARSING_DATA, {
        moof: moof,
        mdat: mdat,
        startPTS: firstPTS / 90000,
        endPTS: this.nextAacPts / 90000,
        startDTS: firstDTS / 90000,
        endDTS: (aacSample.dts + mp4Sample.duration) / 90000,
        type: 'audio',
        nb: samples.length
      });
    }
  }, {
    key: '_ADTStoAudioConfig',
    value: function _ADTStoAudioConfig(data, audioCodec) {
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
      adtsObjectType = ((data[2] & 192) >>> 6) + 1;
      adtsSampleingIndex = (data[2] & 60) >>> 2;
      adtsChanelConfig = (data[2] & 1) << 2;
      // byte 3
      adtsChanelConfig |= (data[3] & 192) >>> 6;

      console.log('manifest codec:' + audioCodec + ',ADTS data:type:' + adtsObjectType + ',sampleingIndex:' + adtsSampleingIndex + '[' + adtsSampleingRates[adtsSampleingIndex] + 'kHz],channelConfig:' + adtsChanelConfig);

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
          this._initPTS = this._aacSamples[0].pts - 90000 * this.timeOffset;
          this._initDTS = this._aacSamples[0].dts - 90000 * this.timeOffset;
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
            this._initPTS = this._avcSamples[0].pts - 90000 * this.timeOffset;
            this._initDTS = this._avcSamples[0].dts - 90000 * this.timeOffset;
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
            this._initPTS = Math.min(this._avcSamples[0].pts, this._aacSamples[0].pts) - 90000 * this.timeOffset;
            this._initDTS = Math.min(this._avcSamples[0].dts, this._aacSamples[0].dts) - 90000 * this.timeOffset;
          }
        }
      }
    }
  }]);

  return TSDemuxer;
})();

exports['default'] = TSDemuxer;
module.exports = exports['default'];

},{"../events":9,"../observer":13,"../remux/mp4-generator":14,"../utils/logger":16,"./exp-golomb":6}],8:[function(require,module,exports){
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
      case 'duration':
        self.demuxer.setDuration(ev.data.data);
        break;
      case 'switchLevel':
        self.demuxer.switchLevel();
        break;
      case 'demux':
        self.demuxer.push(new Uint8Array(ev.data.data), ev.data.audioCodec, ev.data.videoCodec, ev.data.timeOffset);
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
  _observer2['default'].on(_events2['default'].FRAG_PARSED, function (ev) {
    var objData = { event: ev };
    self.postMessage(objData);
  });
};

exports['default'] = TSDemuxerWorker;
module.exports = exports['default'];

},{"../demux/tsdemuxer":7,"../events":9,"../observer":13}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = {
  // fired when MediaSource has been succesfully attached to video element - data: { mediaSource }
  MSE_ATTACHED: 'hlsMediaSourceAttached',
  // fired after manifest has been loaded - data: { levels : [available quality levels] , url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
  MANIFEST_LOADED: 'hlsManifestLoaded',
  // fired after manifest has been parsed - data: { levels : [available quality levels] , startLevel : playback start level, audiocodecswitch: true if different audio codecs used}
  MANIFEST_PARSED: 'hlsManifestParsed',
  // fired when a level playlist loading starts - data: { levelId : id of level being loaded}
  LEVEL_LOADING: 'hlsLevelLoading',
  // fired when a level playlist loading finishes - data: { details : levelDetails object, levelId : id of loaded level, stats : { trequest, tfirst, tload, mtime} }
  LEVEL_LOADED: 'hlsLevelLoaded',
  // fired when a level switch is requested - data: { levelId : id of new level }
  LEVEL_SWITCH: 'hlsLevelSwitch',
  // fired when a fragment loading starts - data: { frag : fragment object}
  FRAG_LOADING: 'hlsFragmentLoading',
  // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length}}
  FRAG_LOADED: 'hlsFragmentLoaded',
  // fired when Init Segment has been extracted from fragment - data: { moov : moov MP4 box, codecs : codecs found while parsing fragment}
  FRAG_PARSING_INIT_SEGMENT: 'hlsFragmentParsingInitSegment',
  // fired when moof/mdat have been extracted from fragment - data: { moof : moof MP4 box, mdat : mdat MP4 box}
  FRAG_PARSING_DATA: 'hlsFragmentParsingData',
  // fired when fragment parsing is completed - data: undefined
  FRAG_PARSED: 'hlsFragmentParsed',
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED: 'hlsFragmentBuffered',
  // fired when fragment matching with current video position is changing - data : { frag : fragment object }
  FRAG_CHANGED: 'hlsFragmentChanged',
  // Identifier for playlist load error - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_ERROR: 'hlsLevelLoadError',
  // Identifier for playlist load timeout - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_TIMEOUT: 'hlsLevelLoadTimeOut',
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_ERROR: 'hlsLevelError',
  // Identifier for fragment load error - data: { url : faulty URL, response : XHR response}
  FRAG_LOAD_ERROR: 'hlsFragLoadError',
  // Identifier for fragment load timeout - data: { url : faulty URL, response : XHR response}
  FRAG_LOAD_TIMEOUT: 'hlsFragLoadTimeOut',
  // Identifier for a fragment parsing error event - data: parsing error description
  FRAG_PARSING_ERROR: 'hlsFragmentParsingError',
  // Identifier for a fragment appending error event - data: appending error description
  FRAG_APPENDING_ERROR: 'hlsFragmentAppendingError'
};
module.exports = exports['default'];

},{}],10:[function(require,module,exports){
/**
 * HLS engine
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

var _stats = require('./stats');

var _stats2 = _interopRequireDefault(_stats);

var _observer = require('./observer');

var _observer2 = _interopRequireDefault(_observer);

var _loaderPlaylistLoader = require('./loader/playlist-loader');

var _loaderPlaylistLoader2 = _interopRequireDefault(_loaderPlaylistLoader);

var _controllerBufferController = require('./controller/buffer-controller');

var _controllerBufferController2 = _interopRequireDefault(_controllerBufferController);

var _controllerLevelController = require('./controller/level-controller');

var _controllerLevelController2 = _interopRequireDefault(_controllerLevelController);

var _utilsLogger = require('./utils/logger');

var _utilsXhrLoader = require('./utils/xhr-loader');

var _utilsXhrLoader2 = _interopRequireDefault(_utilsXhrLoader);

//import MP4Inspect         from '/remux/mp4-inspector';

var Hls = (function () {
  function Hls() {
    var config = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Hls);

    var configDefault = {
      debug: false,
      maxBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000,
      enableWorker: true,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 1000,
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 1000,
      loader: _utilsXhrLoader2['default']
    };
    for (var prop in configDefault) {
      if (prop in config) {
        continue;
      }
      config[prop] = configDefault[prop];
    }
    (0, _utilsLogger.enableLogs)(config.debug);

    this.playlistLoader = new _loaderPlaylistLoader2['default'](config);
    this.levelController = new _controllerLevelController2['default'](this.playlistLoader);
    this.bufferController = new _controllerBufferController2['default'](this.levelController, config);
    this.statsHandler = new _stats2['default'](config);
    this.Events = _events2['default'];
    // observer setup
    this.on = _observer2['default'].on.bind(_observer2['default']);
    this.off = _observer2['default'].removeListener.bind(_observer2['default']);
  }

  _createClass(Hls, [{
    key: 'destroy',
    value: function destroy() {
      if (this.playlistLoader) {
        this.playlistLoader.destroy();
        this.playlistLoader = null;
      }
      if (this.bufferController) {
        this.bufferController.destroy();
        this.bufferController = null;
      }
      if (this.levelController) {
        this.levelController.destroy();
        this.levelController = null;
      }
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
        ms.endOfStream();
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
      this.playlistLoader.load(url, null);
    }
  }, {
    key: 'recoverError',
    value: function recoverError() {
      _utilsLogger.logger.log('try to recover error');
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
      _observer2['default'].trigger(_events2['default'].MSE_ATTACHED, { video: this.video, mediaSource: this.mediaSource });
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

    /** Return the quality level of last loaded fragment **/
    get: function () {
      return this.levelController.level;
    },

    /* set quality level for next loaded fragment (-1 for automatic level selection) */
    set: function (newLevel) {
      this.levelController.manualLevel = newLevel;
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
  }]);

  return Hls;
})();

exports['default'] = Hls;
module.exports = exports['default'];

},{"./controller/buffer-controller":3,"./controller/level-controller":4,"./events":9,"./loader/playlist-loader":12,"./observer":13,"./stats":15,"./utils/logger":16,"./utils/xhr-loader":17}],11:[function(require,module,exports){
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

var FragmentLoader = (function () {
  function FragmentLoader(config) {
    _classCallCheck(this, FragmentLoader);

    this.config = config;
  }

  _createClass(FragmentLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
    }
  }, {
    key: 'abort',
    value: function abort() {
      if (this.loader) {
        this.loader.abort();
      }
    }
  }, {
    key: 'load',
    value: function load(frag) {
      this.frag = frag;
      this.loader = new this.config.loader();
      this.loader.load(frag.url, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), this.config.fragLoadingTimeOut, this.config.fragLoadingMaxRetry, this.config.fragLoadingRetryDelay);
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var payload = event.currentTarget.response;
      stats.length = payload.byteLength;
      _observer2['default'].trigger(_events2['default'].FRAG_LOADED, { payload: payload,
        frag: this.frag,
        stats: stats });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      _observer2['default'].trigger(_events2['default'].FRAG_LOAD_ERROR, { url: this.frag.url, event: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      _observer2['default'].trigger(_events2['default'].FRAG_LOAD_TIMEOUT, { url: this.frag.url });
    }
  }]);

  return FragmentLoader;
})();

exports['default'] = FragmentLoader;
module.exports = exports['default'];

},{"../events":9,"../observer":13}],12:[function(require,module,exports){
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

//import {logger}             from '../utils/logger';

var PlaylistLoader = (function () {
  function PlaylistLoader(config) {
    _classCallCheck(this, PlaylistLoader);

    this.config = config;
    this.manifestLoaded = false;
  }

  _createClass(PlaylistLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      this.url = this.id = null;
    }
  }, {
    key: 'abort',
    value: function abort() {
      if (this.loader) {
        this.loader.abort();
      }
    }
  }, {
    key: 'load',
    value: function load(url, requestId) {
      this.url = url;
      this.id = requestId;
      this.loader = new this.config.loader();
      this.loader.load(url, '', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), this.config.manifestLoadingTimeOut, this.config.manifestLoadingMaxRetry, this.config.manifestLoadingRetryDelay);
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
          level = { url: baseurl, fragments: [], live: true },
          result,
          regexp;
      regexp = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT(INF):([\d\.]+)[^\r\n]*[\r\n]+([^\r\n]+)|(?:#EXT-X-(ENDLIST)))/g;
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
          case 'INF':
            var duration = parseFloat(result[1]);
            level.fragments.push({ url: this.resolve(result[2], baseurl), duration: duration, start: totalduration, sn: currentSN++, level: id });
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
              levelId: id,
              stats: stats });
          }
        } else {
          levels = this.parseMasterPlaylist(string, url);
          // multi level playlist, parse level info
          if (levels.length) {
            _observer2['default'].trigger(_events2['default'].MANIFEST_LOADED, { levels: levels,
              url: url,
              id: id,
              stats: stats });
          } else {
            _observer2['default'].trigger(_events2['default'].LOAD_ERROR, { url: url, response: 'no level found in manifest' });
          }
        }
      } else {
        _observer2['default'].trigger(_events2['default'].LOAD_ERROR, { url: url, response: event.currentTarget });
      }
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      _observer2['default'].trigger(_events2['default'].LEVEL_LOAD_ERROR, { url: this.url, response: event.currentTarget });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      _observer2['default'].trigger(_events2['default'].LEVEL_LOAD_TIMEOUT, { url: this.url });
    }
  }]);

  return PlaylistLoader;
})();

exports['default'] = PlaylistLoader;
module.exports = exports['default'];

},{"../events":9,"../observer":13}],13:[function(require,module,exports){
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

exports['default'] = observer;
module.exports = exports['default'];

},{"events":1}],14:[function(require,module,exports){
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
    value: function mdhd(duration) {
      return MP4.box(MP4.types.mdhd, new Uint8Array([0, // version 0
      0, 0, 0, // flags
      0, 0, 0, 2, // creation_time
      0, 0, 0, 3, // modification_time
      0, 1, 95, 144, duration >> 24, duration >> 16 & 255, duration >> 8 & 255, duration & 255, // duration
      85, 196, // 'und' language (undetermined)
      0, 0]));
    }
  }, {
    key: 'mdia',
    value: function mdia(track) {
      return MP4.box(MP4.types.mdia, MP4.mdhd(track.duration), MP4.hdlr(track.type), MP4.minf(track));
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

      return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(tracks[0].duration)].concat(boxes).concat(MP4.mvex(tracks)));
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
    value: function mvhd(duration) {
      var bytes = new Uint8Array([0, // version 0
      0, 0, 0, // flags
      0, 0, 0, 1, // creation_time
      0, 0, 0, 2, // modification_time
      0, 1, 95, 144, duration >> 24, duration >> 16 & 255, duration >> 8 & 255, duration & 255, // duration
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
      track.profileCompatibility, // profile_compatibility
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
        sample.flags.isLeading << 2 | sample.flags.dependsOn, sample.flags.isDependedOn << 6 | sample.flags.hasRedundancy << 4 | sample.flags.paddingValue << 1 | sample.flags.isNonSyncSample, sample.flags.degradationPriority & 240 << 8, sample.flags.degradationPriority & 15, // sample_flags
        sample.compositionTimeOffset >>> 24 & 255, sample.compositionTimeOffset >>> 16 & 255, sample.compositionTimeOffset >>> 8 & 255, sample.compositionTimeOffset & 255 // sample_composition_time_offset
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
// timescale, 90,000 "ticks" per second
// flags
// sequence_number
// timescale, 90,000 "ticks" per second
// reserved
// flags
// track_ID
// flags
// baseMediaDecodeTime
// flags

},{}],15:[function(require,module,exports){
/*
* Stats Handler
*
*/

// import Event                from './events';
// import observer             from './observer';

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var StatsHandler = (function () {
  function StatsHandler(config) {
    _classCallCheck(this, StatsHandler);

    this.config = config;
  }

  _createClass(StatsHandler, [{
    key: 'destroy',
    value: function destroy() {}
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
    key: 'stats',
    get: function () {
      return { tech: 'hls.js' };
    }
  }]);

  return StatsHandler;
})();

exports['default'] = StatsHandler;
module.exports = exports['default'];

},{}],16:[function(require,module,exports){
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

},{}],17:[function(require,module,exports){
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
        this.loader.abort();
      }
      if (this.timeoutHandle) {
        window.clearTimeout(this.timeoutHandle);
      }
    }
  }, {
    key: 'load',
    value: function load(url, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay) {
      this.url = url;
      this.responseType = responseType;
      this.onSuccess = onSuccess;
      this.onTimeout = onTimeout;
      this.onError = onError;
      this.trequest = new Date();
      this.timeout = timeout;
      this.maxRetry = maxRetry;
      this.retryDelay = retryDelay;
      this.retry = 0;
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
      this.tfirst = null;
      this.loaded = 0;
      xhr.send();
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event) {
      window.clearTimeout(this.timeoutHandle);
      this.onSuccess(event, { trequest: this.trequest, tfirst: this.tfirst, tload: new Date(), loaded: this.loaded });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      if (this.retry < this.maxRetry) {
        _utilsLogger.logger.log('' + event.type + ' while loading ' + this.url + ', retrying in ' + this.retryDelay + '...');
        this.destroy();
        window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
        // exponential backoff
        this.retryDelay = Math.min(2 * this.retryDelay, 64000);
        this.retry++;
      } else {
        window.clearTimeout(this.timeoutHandle);
        _utilsLogger.logger.log('' + event.type + ' while loading ' + this.url);
        this.onError(event);
      }
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout(event) {
      _utilsLogger.logger.log('timeout while loading ' + this.url);
      this.onTimeout(event, { trequest: this.trequest, tfirst: this.tfirst, loaded: this.loaded });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event) {
      if (this.tfirst === null) {
        this.tfirst = new Date();
      }
      if (event.lengthComputable) {
        this.loaded = event.loaded;
      }
    }
  }]);

  return XhrLoader;
})();

exports['default'] = XhrLoader;
module.exports = exports['default'];

},{"../utils/logger":16}]},{},[10])(10)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2V2ZW50cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvaGxzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvcGxheWxpc3QtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9vYnNlcnZlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvc3RhdHMuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL3V0aWxzL2xvZ2dlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMveGhyLWxvYWRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsUUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsRUFBSSxFQUFFLEVBQUksRUFBRSxHQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxDQUFJO09BQzdCLENBQUMsQ0FBQztBQUNILFNBQUcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FDOUIsQ0FBSTtBQUNKLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUNoQixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7QUFDdEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsUUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsRUFBSSxFQUFFLEVBQUksRUFBRSxHQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxDQUFJO09BQzdCLENBQUMsQ0FBQztBQUNILFNBQUcsQ0FBQyxVQUFVLEdBQUc7QUFDZixlQUFPLEVBQUMsR0FBRyxDQUFDLFVBQVU7QUFDdEIsZUFBTyxFQUFDLEdBQUcsQ0FBQyxVQUFVO09BQ3ZCLENBQUM7QUFDRixTQUFHLENBQUMsSUFBSSxHQUFHLElBQUksVUFBVSxDQUFDLENBQ3hCLENBQUk7QUFDSixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUs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QUksVUFBVSxDQUFDLENBQzVDLENBQUk7QUFDSixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLEFBQUMsV0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUksR0FBSSxFQUN2QixBQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFJLEdBQUksRUFDdkIsQUFBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBSSxHQUFJLEVBQ3RCLEtBQUssQ0FBQyxFQUFFLEdBQUcsR0FBSTtBQUNmLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDckIsS0FBSyxDQUFDLFFBQVEsSUFBSSxFQUFFLEVBQ3JCLEFBQUMsS0FBSyxDQUFDLFFBQVEsSUFBSSxFQUFFLEdBQUksR0FBSSxFQUM3QixBQUFDLEtBQUssQ0FBQyxRQUFRLElBQUssQ0FBQyxHQUFJLEdBQUksRUFDN0IsS0FBSyxDQUFDLFFBQVEsR0FBRyxHQUFJO0FBQ3JCLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSTtBQUNWLE9BQUksRUFBRSxDQUFJO0FBQ1YsT0FBSSxFQUFFLENBQUk7QUFDVixPQUFJLEVBQUUsQ0FBSTtBQUNWLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFB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QUFDO0FBQ2pELFVBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFDLEVBQUMsUUFBUSxFQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFHLElBQUksQ0FBQyxNQUFNLEVBQUMsQ0FBQyxDQUFDO0tBQzlGOzs7V0FFVyxzQkFBQyxLQUFLLEVBQUU7QUFDbEIsVUFBRyxJQUFJLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtBQUN2QixZQUFJLENBQUMsTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7T0FDMUI7QUFDRCxVQUFHLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRTtBQUN6QixZQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7T0FDNUI7S0FDRjs7O1NBOUVJLFNBQVM7OztxQkFpRkQsU0FBUyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgYnVuZGxlRm4gPSBhcmd1bWVudHNbM107XG52YXIgc291cmNlcyA9IGFyZ3VtZW50c1s0XTtcbnZhciBjYWNoZSA9IGFyZ3VtZW50c1s1XTtcblxudmFyIHN0cmluZ2lmeSA9IEpTT04uc3RyaW5naWZ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIHdrZXk7XG4gICAgdmFyIGNhY2hlS2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlKTtcbiAgICBcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgaWYgKGNhY2hlW2tleV0uZXhwb3J0cyA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoIXdrZXkpIHtcbiAgICAgICAgd2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgICAgICB2YXIgd2NhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgICAgIHdjYWNoZVtrZXldID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZXNbd2tleV0gPSBbXG4gICAgICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnLCdtb2R1bGUnLCdleHBvcnRzJ10sICcoJyArIGZuICsgJykoc2VsZiknKSxcbiAgICAgICAgICAgIHdjYWNoZVxuICAgICAgICBdO1xuICAgIH1cbiAgICB2YXIgc2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgIFxuICAgIHZhciBzY2FjaGUgPSB7fTsgc2NhY2hlW3drZXldID0gd2tleTtcbiAgICBzb3VyY2VzW3NrZXldID0gW1xuICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnXSwncmVxdWlyZSgnICsgc3RyaW5naWZ5KHdrZXkpICsgJykoc2VsZiknKSxcbiAgICAgICAgc2NhY2hlXG4gICAgXTtcbiAgICBcbiAgICB2YXIgc3JjID0gJygnICsgYnVuZGxlRm4gKyAnKSh7J1xuICAgICAgICArIE9iamVjdC5rZXlzKHNvdXJjZXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5naWZ5KGtleSkgKyAnOlsnXG4gICAgICAgICAgICAgICAgKyBzb3VyY2VzW2tleV1bMF1cbiAgICAgICAgICAgICAgICArICcsJyArIHN0cmluZ2lmeShzb3VyY2VzW2tleV1bMV0pICsgJ10nXG4gICAgICAgICAgICA7XG4gICAgICAgIH0pLmpvaW4oJywnKVxuICAgICAgICArICd9LHt9LFsnICsgc3RyaW5naWZ5KHNrZXkpICsgJ10pJ1xuICAgIDtcbiAgICBcbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuICAgIFxuICAgIHJldHVybiBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoXG4gICAgICAgIG5ldyBCbG9iKFtzcmNdLCB7IHR5cGU6ICd0ZXh0L2phdmFzY3JpcHQnIH0pXG4gICAgKSk7XG59O1xuIiwiLypcbiAqIGJ1ZmZlciBjb250cm9sbGVyXG4gKlxuICovXG5cbiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRnJhZ21lbnRMb2FkZXIgICAgICAgZnJvbSAnLi4vbG9hZGVyL2ZyYWdtZW50LWxvYWRlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbiBpbXBvcnQgRGVtdXhlciAgICAgICAgICAgICAgZnJvbSAnLi4vZGVtdXgvZGVtdXhlcic7XG5cbiBjbGFzcyBCdWZmZXJDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihsZXZlbENvbnRyb2xsZXIsY29uZmlnKSB7XG4gICAgdGhpcy5FUlJPUiA9IC0yO1xuICAgIHRoaXMuU1RBUlRJTkcgPSAtMTtcbiAgICB0aGlzLklETEUgPSAwO1xuICAgIHRoaXMuTE9BRElORyA9ICAxO1xuICAgIHRoaXMuV0FJVElOR19MRVZFTCA9IDI7XG4gICAgdGhpcy5QQVJTSU5HID0gMztcbiAgICB0aGlzLlBBUlNFRCA9IDQ7XG4gICAgdGhpcy5BUFBFTkRJTkcgPSA1O1xuICAgIHRoaXMuQlVGRkVSX0ZMVVNISU5HID0gNjtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IGxldmVsQ29udHJvbGxlcjtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSAwO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIgPSBuZXcgRnJhZ21lbnRMb2FkZXIoY29uZmlnKTtcbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25zYmUgID0gdGhpcy5vblNvdXJjZUJ1ZmZlckVycm9yLmJpbmQodGhpcyk7XG4gICAgLy8gaW50ZXJuYWwgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NU0VBdHRhY2hlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tcCA9IHRoaXMub25NYW5pZmVzdFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbCA9IHRoaXMub25GcmFnbWVudExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25pcyA9IHRoaXMub25Jbml0U2VnbWVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcGcgPSB0aGlzLm9uRnJhZ21lbnRQYXJzaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwID0gdGhpcy5vbkZyYWdtZW50UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsdCA9IHRoaXMub25GcmFnbWVudExvYWRUaW1lb3V0LmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsZSA9IHRoaXMub25GcmFnbWVudExvYWRFcnJvci5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTVNFX0FUVEFDSEVELCB0aGlzLm9ubXNlKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHRoaXMub25tcCk7XG4gIH1cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmRlc3Ryb3koKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHRoaXMub25tcCk7XG4gICAgLy8gcmVtb3ZlIHZpZGVvIGxpc3RlbmVyXG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVraW5nJyx0aGlzLm9udnNlZWtpbmcpO1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVrZWQnLHRoaXMub252c2Vla2VkKTtcbiAgICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLHRoaXMub252bWV0YWRhdGEpO1xuICAgICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9udm1ldGFkYXRhID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgfVxuXG4gIHN0YXJ0KCkge1xuICAgIHRoaXMuc3RhcnRJbnRlcm5hbCgpO1xuICAgIGlmKHRoaXMubGFzdEN1cnJlbnRUaW1lKSB7XG4gICAgICBsb2dnZXIubG9nKGByZXN1bWluZyB2aWRlbyBAICR7dGhpcy5sYXN0Q3VycmVudFRpbWV9YCk7XG4gICAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLlNUQVJUSU5HO1xuICAgIH1cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIHN0YXJ0SW50ZXJuYWwoKSB7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXIodGhpcy5jb25maWcpO1xuICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9udGljaywgMTAwKTtcbiAgICB0aGlzLmFwcGVuZEVycm9yPTA7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgdGhpcy5vbmlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgdGhpcy5vbmZwZyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FEX0VSUk9SLCB0aGlzLm9uZmxlKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURfVElNRU9VVCwgdGhpcy5vbmZsdCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICB9XG5cblxuICBzdG9wKCkge1xuICAgIHRoaXMubXA0c2VnbWVudHMgPSBbXTtcbiAgICB0aGlzLmZsdXNoUmFuZ2UgPSBbXTtcbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gW107XG4gICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmFib3J0KCk7XG4gICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgIGlmKHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZih0aGlzLmRlbXV4ZXIpIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX1BBUlNFRCwgdGhpcy5vbmZwKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgdGhpcy5vbmZwZyk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FEX0VSUk9SLCB0aGlzLm9uZmxlKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX0xPQURfVElNRU9VVCwgdGhpcy5vbmZsdCk7XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHZhciBwb3MsbGV2ZWwsbGV2ZWxJbmZvLGZyYWdJZHg7XG4gICAgc3dpdGNoKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgdGhpcy5FUlJPUjpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBlcnJvciBzdGF0ZSB0byBhdm9pZCBicmVha2luZyBmdXJ0aGVyIC4uLlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5TVEFSVElORzpcbiAgICAgICAgLy8gZGV0ZXJtaW5lIGxvYWQgbGV2ZWxcbiAgICAgICAgdGhpcy5zdGFydExldmVsID0gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgICAgICAgaWYgKHRoaXMuc3RhcnRMZXZlbCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyAtMSA6IGd1ZXNzIHN0YXJ0IExldmVsIGJ5IGRvaW5nIGEgYml0cmF0ZSB0ZXN0IGJ5IGxvYWRpbmcgZmlyc3QgZnJhZ21lbnQgb2YgbG93ZXN0IHF1YWxpdHkgbGV2ZWxcbiAgICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSAwO1xuICAgICAgICAgIHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IG5ldyBsZXZlbCB0byBwbGF5bGlzdCBsb2FkZXIgOiB0aGlzIHdpbGwgdHJpZ2dlciBzdGFydCBsZXZlbCBsb2FkXG4gICAgICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5XQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSB0aGlzLklETEU6XG4gICAgICAgIC8vIGhhbmRsZSBlbmQgb2YgaW1tZWRpYXRlIHN3aXRjaGluZyBpZiBuZWVkZWRcbiAgICAgICAgaWYodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgICAgICB0aGlzLmltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZWVrIGJhY2sgdG8gYSBleHBlY3RlZCBwb3NpdGlvbiBhZnRlciB2aWRlbyBzdGFsbGluZ1xuICAgICAgICBpZih0aGlzLnNlZWtBZnRlclN0YWxsaW5nKSB7XG4gICAgICAgICAgdGhpcy52aWRlby5jdXJyZW50VGltZT10aGlzLnNlZWtBZnRlclN0YWxsaW5nO1xuICAgICAgICAgIHRoaXMuc2Vla0FmdGVyU3RhbGxpbmcgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBjYW5kaWRhdGUgZnJhZ21lbnQgdG8gYmUgbG9hZGVkLCBiYXNlZCBvbiBjdXJyZW50IHBvc2l0aW9uIGFuZFxuICAgICAgICAvLyAgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAvLyAgZW5zdXJlIDYwcyBvZiBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiB3ZSBoYXZlIG5vdCB5ZXQgbG9hZGVkIGFueSBmcmFnbWVudCwgc3RhcnQgbG9hZGluZyBmcm9tIHN0YXJ0IHBvc2l0aW9uXG4gICAgICAgIGlmKHRoaXMubG9hZGVkbWV0YWRhdGEpIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBvcyA9IHRoaXMubmV4dExvYWRQb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBsb2FkIGxldmVsXG4gICAgICAgIGlmKHRoaXMuc3RhcnRGcmFnbWVudExvYWRlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBsZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB3ZSBhcmUgbm90IGF0IHBsYXliYWNrIHN0YXJ0LCBnZXQgbmV4dCBsb2FkIGxldmVsIGZyb20gbGV2ZWwgQ29udHJvbGxlclxuICAgICAgICAgIGxldmVsID0gdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExldmVsKCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSB0aGlzLmJ1ZmZlckluZm8ocG9zKSwgYnVmZmVyTGVuID0gYnVmZmVySW5mby5sZW4sIGJ1ZmZlckVuZCA9IGJ1ZmZlckluZm8uZW5kLCBtYXhCdWZMZW47XG4gICAgICAgIC8vIGNvbXB1dGUgbWF4IEJ1ZmZlciBMZW5ndGggdGhhdCB3ZSBjb3VsZCBnZXQgZnJvbSB0aGlzIGxvYWQgbGV2ZWwsIGJhc2VkIG9uIGxldmVsIGJpdHJhdGUuIGRvbid0IGJ1ZmZlciBtb3JlIHRoYW4gNjAgTUIgYW5kIG1vcmUgdGhhbiAzMHNcbiAgICAgICAgaWYoKHRoaXMubGV2ZWxzW2xldmVsXSkuaGFzT3duUHJvcGVydHkoJ2JpdHJhdGUnKSkge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWF4KDgqdGhpcy5jb25maWcubWF4QnVmZmVyU2l6ZS90aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSx0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IHRoaXMuY29uZmlnLm1heEJ1ZmZlckxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBidWZmZXIgbGVuZ3RoIGlzIGxlc3MgdGhhbiBtYXhCdWZMZW4gdHJ5IHRvIGxvYWQgYSBuZXcgZnJhZ21lbnRcbiAgICAgICAgaWYoYnVmZmVyTGVuIDwgbWF4QnVmTGVuKSB7XG4gICAgICAgICAgaWYobGV2ZWwgIT09IHRoaXMubGV2ZWwpIHtcbiAgICAgICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkIGlmIG5lZWRlZFxuICAgICAgICAgICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICAgIC8vIHRlbGwgZGVtdXhlciB0aGF0IHdlIHdpbGwgc3dpdGNoIGxldmVsICh0aGlzIHdpbGwgZm9yY2UgaW5pdCBzZWdtZW50IHRvIGJlIHJlZ2VuZXJhdGVkKVxuICAgICAgICAgICAgaWYgKHRoaXMuZGVtdXhlcikge1xuICAgICAgICAgICAgICB0aGlzLmRlbXV4ZXIuc3dpdGNoTGV2ZWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgbGV2ZWxJbmZvID0gdGhpcy5sZXZlbHNbbGV2ZWxdLmRldGFpbHM7XG4gICAgICAgICAgLy8gaWYgbGV2ZWwgaW5mbyBub3QgcmV0cmlldmVkIHlldCwgc3dpdGNoIHN0YXRlIGFuZCB3YWl0IGZvciBsZXZlbCByZXRyaWV2YWxcbiAgICAgICAgICBpZih0eXBlb2YgbGV2ZWxJbmZvID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuV0FJVElOR19MRVZFTDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBmaW5kIGZyYWdtZW50IGluZGV4LCBjb250aWd1b3VzIHdpdGggZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAgIHZhciBmcmFnbWVudHMgPSBsZXZlbEluZm8uZnJhZ21lbnRzLCBmcmFnLCBzbGlkaW5nID0gbGV2ZWxJbmZvLnNsaWRpbmcsIHN0YXJ0ID0gZnJhZ21lbnRzWzBdLnN0YXJ0ICsgc2xpZGluZztcbiAgICAgICAgICAvLyBjaGVjayBpZiByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgd2l0aGluIHNlZWthYmxlIGJvdW5kYXJpZXMgOlxuICAgICAgICAgIC8vIGluIGNhc2Ugb2YgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0IHJlcXVlc3RlZCBwb3NpdGlvbiBpcyBub3QgbG9jYXRlZCBiZWZvcmUgcGxheWxpc3Qgc3RhcnRcbiAgICAgICAgICAvL2xvZ2dlci5sb2coYHN0YXJ0L3Bvcy9idWZFbmQvc2Vla2luZzoke3N0YXJ0LnRvRml4ZWQoMyl9LyR7cG9zLnRvRml4ZWQoMyl9LyR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9LyR7dGhpcy52aWRlby5zZWVraW5nfWApO1xuICAgICAgICAgIGlmKGJ1ZmZlckVuZCA8IHN0YXJ0KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2Vla0FmdGVyU3RhbGxpbmcgPSB0aGlzLnN0YXJ0UG9zaXRpb24gKyBzbGlkaW5nO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBidWZmZXIgZW5kOiAke2J1ZmZlckVuZH0gaXMgbG9jYXRlZCBiZWZvcmUgc3RhcnQgb2YgbGl2ZSBzbGlkaW5nIHBsYXlsaXN0LCBtZWRpYSBwb3NpdGlvbiB3aWxsIGJlIHJlc2V0ZWQgdG86ICR7dGhpcy5zZWVrQWZ0ZXJTdGFsbGluZy50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICBidWZmZXJFbmQgPSB0aGlzLnNlZWtBZnRlclN0YWxsaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvL2xvb2sgZm9yIGZyYWdtZW50cyBtYXRjaGluZyB3aXRoIGN1cnJlbnQgcGxheSBwb3NpdGlvblxuICAgICAgICAgIGZvciAoZnJhZ0lkeCA9IDA7IGZyYWdJZHggPCBmcmFnbWVudHMubGVuZ3RoIDsgZnJhZ0lkeCsrKSB7XG4gICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHhdO1xuICAgICAgICAgICAgc3RhcnQgPSBmcmFnLnN0YXJ0K3NsaWRpbmc7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coYGxldmVsL3NuL3NsaWRpbmcvc3RhcnQvZW5kL2J1ZkVuZDoke2xldmVsfS8ke2ZyYWcuc259LyR7c2xpZGluZ30vJHtzdGFydH0vJHtzdGFydCtmcmFnLmR1cmF0aW9ufS8ke2J1ZmZlckVuZH1gKTtcbiAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5XG4gICAgICAgICAgICBpZihzdGFydCA8PSBidWZmZXJFbmQgJiYgKHN0YXJ0ICsgZnJhZy5kdXJhdGlvbikgPiBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGZyYWdJZHggPj0gMCAmJiBmcmFnSWR4IDwgZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIFNOIG1hdGNoaW5nIHdpdGggcG9zOicgKyAgYnVmZmVyRW5kICsgJzonICsgZnJhZy5zbik7XG4gICAgICAgICAgICBpZih0aGlzLmZyYWcgJiYgZnJhZy5zbiA9PT0gdGhpcy5mcmFnLnNuKSB7XG4gICAgICAgICAgICAgIGlmKGZyYWdJZHggPT09IChmcmFnbWVudHMubGVuZ3RoIC0xKSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGFyZSBhdCB0aGUgZW5kIG9mIHRoZSBwbGF5bGlzdCBhbmQgd2UgYWxyZWFkeSBsb2FkZWQgbGFzdCBmcmFnbWVudCwgZG9uJ3QgZG8gYW55dGhpbmdcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHgrMV07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgU04ganVzdCBsb2FkZWQsIGxvYWQgbmV4dCBvbmU6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyAgICAgICAke2ZyYWcuc259IG9mIFske2ZyYWdtZW50c1swXS5zbn0gLCR7ZnJhZ21lbnRzW2ZyYWdtZW50cy5sZW5ndGgtMV0uc259XSxsZXZlbCAke2xldmVsfWApO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCcgICAgICBsb2FkaW5nIGZyYWcgJyArIGkgKycscG9zL2J1ZkVuZDonICsgcG9zLnRvRml4ZWQoMykgKyAnLycgKyBidWZmZXJFbmQudG9GaXhlZCgzKSk7XG5cbiAgICAgICAgICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgICAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmxvYWQoZnJhZyk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5MT0FESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5XQUlUSU5HX0xFVkVMOlxuICAgICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICBpZihsZXZlbCAmJiBsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5MT0FESU5HOlxuICAgICAgICAvLyBub3RoaW5nIHRvIGRvLCB3YWl0IGZvciBmcmFnbWVudCByZXRyaWV2YWxcbiAgICAgIGNhc2UgdGhpcy5QQVJTSU5HOlxuICAgICAgICAvLyBub3RoaW5nIHRvIGRvLCB3YWl0IGZvciBmcmFnbWVudCBiZWluZyBwYXJzZWRcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHRoaXMuUEFSU0VEOlxuICAgICAgY2FzZSB0aGlzLkFQUEVORElORzpcbiAgICAgICAgaWYgKHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgICAgLy8gaWYgTVA0IHNlZ21lbnQgYXBwZW5kaW5nIGluIHByb2dyZXNzIG5vdGhpbmcgdG8gZG9cbiAgICAgICAgICBpZigodGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8udXBkYXRpbmcpIHx8XG4gICAgICAgICAgICAgKHRoaXMuc291cmNlQnVmZmVyLnZpZGVvICYmIHRoaXMuc291cmNlQnVmZmVyLnZpZGVvLnVwZGF0aW5nKSkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdzYiBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgLy8gY2hlY2sgaWYgYW55IE1QNCBzZWdtZW50cyBsZWZ0IHRvIGFwcGVuZFxuICAgICAgICAgIH0gZWxzZSBpZih0aGlzLm1wNHNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHNlZ21lbnQgPSB0aGlzLm1wNHNlZ21lbnRzLnNoaWZ0KCk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYGFwcGVuZGluZyAke3NlZ21lbnQudHlwZX0gU0IsIHNpemU6JHtzZWdtZW50LmRhdGEubGVuZ3RofWApO1xuICAgICAgICAgICAgICB0aGlzLnNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLmFwcGVuZEJ1ZmZlcihzZWdtZW50LmRhdGEpO1xuICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yPTA7XG4gICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAvLyBpbiBjYXNlIGFueSBlcnJvciBvY2N1cmVkIHdoaWxlIGFwcGVuZGluZywgcHV0IGJhY2sgc2VnbWVudCBpbiBtcDRzZWdtZW50cyB0YWJsZVxuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBlcnJvciB3aGlsZSB0cnlpbmcgdG8gYXBwZW5kIGJ1ZmZlcjoke2Vyci5tZXNzYWdlfSx0cnkgYXBwZW5kaW5nIGxhdGVyYCk7XG4gICAgICAgICAgICAgIHRoaXMubXA0c2VnbWVudHMudW5zaGlmdChzZWdtZW50KTtcbiAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvcisrO1xuICAgICAgICAgICAgICBpZih0aGlzLmFwcGVuZEVycm9yID4gMykge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZhaWwgMyB0aW1lcyB0byBhcHBlbmQgc2VnbWVudCBpbiBzb3VyY2VCdWZmZXJgKTtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfQVBQRU5ESU5HX0VSUk9SLCB7ZnJhZyA6IHRoaXMuZnJhZ30pO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLkVSUk9SO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuQVBQRU5ESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgdGhpcy5CVUZGRVJfRkxVU0hJTkc6XG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBhbGwgYnVmZmVyIHJhbmdlcyB0byBmbHVzaFxuICAgICAgICB3aGlsZSh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHJhbmdlID0gdGhpcy5mbHVzaFJhbmdlWzBdO1xuICAgICAgICAgIC8vIGZsdXNoQnVmZmVyIHdpbGwgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MgYW5kIGZsdXNoIEF1ZGlvL1ZpZGVvIEJ1ZmZlclxuICAgICAgICAgIGlmKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQscmFuZ2UuZW5kKSkge1xuICAgICAgICAgICAgLy8gcmFuZ2UgZmx1c2hlZCwgcmVtb3ZlIGZyb20gZmx1c2ggYXJyYXlcbiAgICAgICAgICAgIHRoaXMuZmx1c2hSYW5nZS5zaGlmdCgpO1xuICAgICAgICAgICAgLy8gcmVzZXQgZmx1c2ggY291bnRlclxuICAgICAgICAgICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmbHVzaCBpbiBwcm9ncmVzcywgY29tZSBiYWNrIGxhdGVyXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgLy8gbW92ZSB0byBJRExFIG9uY2UgZmx1c2ggY29tcGxldGUuIHRoaXMgc2hvdWxkIHRyaWdnZXIgbmV3IGZyYWdtZW50IGxvYWRpbmdcbiAgICAgICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgICAgICAgIC8vIHJlc2V0IHJlZmVyZW5jZSB0byBmcmFnXG4gICAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICAgLyogaWYgbm90IGV2ZXJ5dGhpbmcgZmx1c2hlZCwgc3RheSBpbiBCVUZGRVJfRkxVU0hJTkcgc3RhdGUuIHdlIHdpbGwgY29tZSBiYWNrIGhlcmVcbiAgICAgICAgICAgIGVhY2ggdGltZSBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgY2FsbGJhY2sgd2lsbCBiZSB0cmlnZ2VyZWRcbiAgICAgICAgICAgICovXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8vIGNoZWNrL3VwZGF0ZSBjdXJyZW50IGZyYWdtZW50XG4gICAgdGhpcy5fY2hlY2tGcmFnbWVudENoYW5nZWQoKTtcbiAgfVxuXG4gICBidWZmZXJJbmZvKHBvcykge1xuICAgIHZhciB2ID0gdGhpcy52aWRlbyxcbiAgICAgICAgYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkLFxuICAgICAgICBidWZmZXJMZW4sXG4gICAgICAgIC8vIGJ1ZmZlclN0YXJ0IGFuZCBidWZmZXJFbmQgYXJlIGJ1ZmZlciBib3VuZGFyaWVzIGFyb3VuZCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uXG4gICAgICAgIGJ1ZmZlclN0YXJ0LGJ1ZmZlckVuZCxcbiAgICAgICAgaTtcbiAgICB2YXIgYnVmZmVyZWQyID0gW107XG4gICAgLy8gdGhlcmUgbWlnaHQgYmUgc29tZSBzbWFsbCBob2xlcyBiZXR3ZWVuIGJ1ZmZlciB0aW1lIHJhbmdlXG4gICAgLy8gY29uc2lkZXIgdGhhdCBob2xlcyBzbWFsbGVyIHRoYW4gMzAwIG1zIGFyZSBpcnJlbGV2YW50IGFuZCBidWlsZCBhbm90aGVyXG4gICAgLy8gYnVmZmVyIHRpbWUgcmFuZ2UgcmVwcmVzZW50YXRpb25zIHRoYXQgZGlzY2FyZHMgdGhvc2UgaG9sZXNcbiAgICBmb3IoaSA9IDAgOyBpIDwgYnVmZmVyZWQubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmKChidWZmZXJlZDIubGVuZ3RoKSAmJiAoYnVmZmVyZWQuc3RhcnQoaSkgLSBidWZmZXJlZDJbYnVmZmVyZWQyLmxlbmd0aC0xXS5lbmQgKSA8IDAuMykge1xuICAgICAgICBidWZmZXJlZDJbYnVmZmVyZWQyLmxlbmd0aC0xXS5lbmQgPSBidWZmZXJlZC5lbmQoaSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidWZmZXJlZDIucHVzaCh7c3RhcnQgOiBidWZmZXJlZC5zdGFydChpKSxlbmQgOiBidWZmZXJlZC5lbmQoaSl9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gcG9zIDsgaSA8IGJ1ZmZlcmVkMi5sZW5ndGggOyBpKyspIHtcbiAgICAgIC8vbG9nZ2VyLmxvZygnYnVmIHN0YXJ0L2VuZDonICsgYnVmZmVyZWQuc3RhcnQoaSkgKyAnLycgKyBidWZmZXJlZC5lbmQoaSkpO1xuICAgICAgaWYoKHBvcyswLjMpID49IGJ1ZmZlcmVkMltpXS5zdGFydCAmJiBwb3MgPCBidWZmZXJlZDJbaV0uZW5kKSB7XG4gICAgICAgIC8vIHBsYXkgcG9zaXRpb24gaXMgaW5zaWRlIHRoaXMgYnVmZmVyIFRpbWVSYW5nZSwgcmV0cmlldmUgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvbiBhbmQgYnVmZmVyIGxlbmd0aFxuICAgICAgICBidWZmZXJTdGFydCA9IGJ1ZmZlcmVkMltpXS5zdGFydDtcbiAgICAgICAgYnVmZmVyRW5kID0gYnVmZmVyZWQyW2ldLmVuZCArIDAuMztcbiAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVyRW5kIC0gcG9zO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge2xlbiA6IGJ1ZmZlckxlbiwgc3RhcnQgOiBidWZmZXJTdGFydCwgZW5kIDogYnVmZmVyRW5kfTtcbiAgfVxuXG5cbiAgZ2V0QnVmZmVyUmFuZ2UocG9zaXRpb24pIHtcbiAgICB2YXIgaSxyYW5nZTtcbiAgICBmb3IgKGkgPSB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aC0xOyBpID49MCA7IGktLSkge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYocG9zaXRpb24gPj0gcmFuZ2Uuc3RhcnQgJiYgcG9zaXRpb24gPD0gcmFuZ2UuZW5kKSB7XG4gICAgICAgIHJldHVybiByYW5nZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdmFyIHJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKTtcbiAgICAgIGlmKHJhbmdlKSB7XG4gICAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBnZXQgbmV4dEJ1ZmZlclJhbmdlKCkge1xuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIC8vIGZpcnN0IGdldCBlbmQgcmFuZ2Ugb2YgY3VycmVudCBmcmFnbWVudFxuICAgICAgcmV0dXJuIHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UodGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZvbGxvd2luZ0J1ZmZlclJhbmdlKHJhbmdlKSB7XG4gICAgaWYocmFuZ2UpIHtcbiAgICAgIC8vIHRyeSB0byBnZXQgcmFuZ2Ugb2YgbmV4dCBmcmFnbWVudCAoNTAwbXMgYWZ0ZXIgdGhpcyByYW5nZSlcbiAgICAgIHJldHVybiB0aGlzLmdldEJ1ZmZlclJhbmdlKHJhbmdlLmVuZCswLjUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICB2YXIgcmFuZ2UgPSB0aGlzLm5leHRCdWZmZXJSYW5nZTtcbiAgICBpZihyYW5nZSkge1xuICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gIH1cblxuICBpc0J1ZmZlcmVkKHBvc2l0aW9uKSB7XG4gICAgdmFyIHYgPSB0aGlzLnZpZGVvLGJ1ZmZlcmVkID0gdi5idWZmZXJlZDtcbiAgICBmb3IodmFyIGkgPSAwIDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aCA7IGkrKykge1xuICAgICAgaWYocG9zaXRpb24gPj0gYnVmZmVyZWQuc3RhcnQoaSkgJiYgcG9zaXRpb24gPD0gYnVmZmVyZWQuZW5kKGkpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfY2hlY2tGcmFnbWVudENoYW5nZWQoKSB7XG4gICAgdmFyIHJhbmdlQ3VycmVudCwgY3VycmVudFRpbWU7XG4gICAgaWYodGhpcy52aWRlbyAmJiB0aGlzLnZpZGVvLnNlZWtpbmcgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lID0gdGhpcy52aWRlby5jdXJyZW50VGltZTtcbiAgICAgIGlmKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSkpIHtcbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYocmFuZ2VDdXJyZW50KSB7XG4gICAgICBpZihyYW5nZUN1cnJlbnQuZnJhZyAhPT0gdGhpcy5mcmFnQ3VycmVudCkge1xuICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gcmFuZ2VDdXJyZW50LmZyYWc7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19DSEFOR0VELCB7IGZyYWcgOiB0aGlzLmZyYWdDdXJyZW50IH0pO1xuICAgICAgICAvLyBpZih0aGlzLmZyYWdDdXJyZW50LmZwc0V4cGVjdGVkKSB7XG4gICAgICAgIC8vICAgdGhpcy5mcmFnQ3VycmVudC5kZWNvZGVkRnJhbWVzRGF0ZSA9IERhdGUubm93KCk7XG4gICAgICAgIC8vICAgdGhpcy5mcmFnQ3VycmVudC5kZWNvZGVkRnJhbWVzTmIgPSB0aGlzLnZpZGVvLndlYmtpdERlY29kZWRGcmFtZUNvdW50O1xuICAgICAgICAvLyAgIGxvZ2dlci5sb2coYGZyYWcgY2hhbmdlZCwgZXhwZWN0ZWQgRlBTOiR7dGhpcy5mcmFnQ3VycmVudC5mcHNFeHBlY3RlZC50b0ZpeGVkKDIpfWApO1xuICAgICAgICAvLyB9XG4gICAgICB9LyogZWxzZSB7XG4gICAgICAgIGlmKHRoaXMuZnJhZ0N1cnJlbnQuZnBzRXhwZWN0ZWQpIHtcbiAgICAgICAgICAvLyBjb21wYXJlIHJlYWwgZnBzIHZzIHRoZW9yaXRpY2FsIG9uZVxuICAgICAgICAgIHZhciBuYm5ldyA9IHRoaXMudmlkZW8ud2Via2l0RGVjb2RlZEZyYW1lQ291bnQ7XG4gICAgICAgICAgdmFyIHRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICAgIGlmKCh0aW1lIC0gdGhpcy5mcmFnQ3VycmVudC5kZWNvZGVkRnJhbWVzRGF0ZSkgPiAyMDAwKSB7XG4gICAgICAgICAgICB2YXIgZnBzID0gMTAwMCoobmJuZXcgLSB0aGlzLmZyYWdDdXJyZW50LmRlY29kZWRGcmFtZXNOYikvKHRpbWUtdGhpcy5mcmFnQ3VycmVudC5kZWNvZGVkRnJhbWVzRGF0ZSk7XG4gICAgICAgICAgICBsb2dnZXIubG9nKGByZWFsL2V4cGVjdGVkIEZQUzoke2Zwcy50b0ZpeGVkKDIpfS8ke3RoaXMuZnJhZ0N1cnJlbnQuZnBzRXhwZWN0ZWQudG9GaXhlZCgyKX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gKi9cbiAgICB9XG4gIH1cblxuLypcbiAgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MsIGFuZCBmbHVzaCBhbGwgYnVmZmVyZWQgZGF0YVxuICByZXR1cm4gdHJ1ZSBvbmNlIGV2ZXJ5dGhpbmcgaGFzIGJlZW4gZmx1c2hlZC5cbiAgc291cmNlQnVmZmVyLmFib3J0KCkgYW5kIHNvdXJjZUJ1ZmZlci5yZW1vdmUoKSBhcmUgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnNcbiAgdGhlIGlkZWEgaXMgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIGZyb20gdGljaygpIHRpbWVyIGFuZCBjYWxsIGl0IGFnYWluIHVudGlsIGFsbCByZXNvdXJjZXMgaGF2ZSBiZWVuIGNsZWFuZWRcbiAgdGhlIHRpbWVyIGlzIHJlYXJtZWQgdXBvbiBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgZXZlbnQsIHNvIHRoaXMgc2hvdWxkIGJlIG9wdGltYWxcbiovXG4gIGZsdXNoQnVmZmVyKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpIHtcbiAgICB2YXIgc2IsaSxidWZTdGFydCxidWZFbmQsIGZsdXNoU3RhcnQsIGZsdXNoRW5kO1xuICAgIC8vbG9nZ2VyLmxvZygnZmx1c2hCdWZmZXIscG9zL3N0YXJ0L2VuZDogJyArIHRoaXMudmlkZW8uY3VycmVudFRpbWUgKyAnLycgKyBzdGFydE9mZnNldCArICcvJyArIGVuZE9mZnNldCk7XG4gICAgLy8gc2FmZWd1YXJkIHRvIGF2b2lkIGluZmluaXRlIGxvb3BpbmdcbiAgICBpZih0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrIDwgMip0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIGlmKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvcihpID0gMCA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgICAgIGJ1ZlN0YXJ0ID0gc2IuYnVmZmVyZWQuc3RhcnQoaSk7XG4gICAgICAgICAgICBidWZFbmQgPSBzYi5idWZmZXJlZC5lbmQoaSk7XG4gICAgICAgICAgICAvLyB3b3JrYXJvdW5kIGZpcmVmb3ggbm90IGFibGUgdG8gcHJvcGVybHkgZmx1c2ggbXVsdGlwbGUgYnVmZmVyZWQgcmFuZ2UuXG4gICAgICAgICAgICBpZihuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiAgZW5kT2Zmc2V0ID09PSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IHN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgICBmbHVzaEVuZCA9IGVuZE9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBNYXRoLm1heChidWZTdGFydCxzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBzb21ldGltZXMgc291cmNlYnVmZmVyLnJlbW92ZSgpIGRvZXMgbm90IGZsdXNoXG4gICAgICAgICAgICAgICB0aGUgZXhhY3QgZXhwZWN0ZWQgdGltZSByYW5nZS5cbiAgICAgICAgICAgICAgIHRvIGF2b2lkIHJvdW5kaW5nIGlzc3Vlcy9pbmZpbml0ZSBsb29wLFxuICAgICAgICAgICAgICAgb25seSBmbHVzaCBidWZmZXIgcmFuZ2Ugb2YgbGVuZ3RoIGdyZWF0ZXIgdGhhbiA1MDBtcy5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZihmbHVzaEVuZCAtIGZsdXNoU3RhcnQgPiAwLjUpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmx1c2ggJHt0eXBlfSBbJHtmbHVzaFN0YXJ0fSwke2ZsdXNoRW5kfV0sIG9mIFske2J1ZlN0YXJ0fSwke2J1ZkVuZH1dLCBwb3M6JHt0aGlzLnZpZGVvLmN1cnJlbnRUaW1lfWApO1xuICAgICAgICAgICAgICBzYi5yZW1vdmUoZmx1c2hTdGFydCxmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZTtcbiAgICBmb3IgKGkgPSAwIDsgaSA8IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoIDsgaSsrKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZih0aGlzLmlzQnVmZmVyZWQoKHJhbmdlLnN0YXJ0ICsgcmFuZ2UuZW5kKS8yKSkge1xuICAgICAgICBuZXdSYW5nZS5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IG5ld1JhbmdlO1xuXG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGZsdXNoZWQnKTtcbiAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWQgIVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgICAvKlxuICAgICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCA6XG4gICAgICAgLSBwYXVzZSBwbGF5YmFjayBpZiBwbGF5aW5nXG4gICAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgICAgLSBhbmQgdHJpZ2dlciBhIGJ1ZmZlciBmbHVzaFxuICAgICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoKCkge1xuICAgIGlmKCF0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSB0cnVlO1xuICAgICAgdGhpcy5wcmV2aW91c2x5UGF1c2VkID0gdGhpcy52aWRlby5wYXVzZWQ7XG4gICAgICB0aGlzLnZpZGVvLnBhdXNlKCk7XG4gICAgfVxuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuYWJvcnQoKTtcbiAgICAvLyBmbHVzaCBldmVyeXRoaW5nXG4gICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goeyBzdGFydCA6IDAsIGVuZCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgIC8vIHRyaWdnZXIgYSBzb3VyY2VCdWZmZXIgZmx1c2hcbiAgICB0aGlzLnN0YXRlID0gdGhpcy5CVUZGRVJfRkxVU0hJTkc7XG4gICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuLypcbiAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggZW5kLCBhZnRlciBuZXcgZnJhZ21lbnQgaGFzIGJlZW4gYnVmZmVyZWQgOlxuICAgIC0gbnVkZ2UgdmlkZW8gZGVjb2RlciBieSBzbGlnaHRseSBhZGp1c3RpbmcgdmlkZW8gY3VycmVudFRpbWVcbiAgICAtIHJlc3VtZSB0aGUgcGxheWJhY2sgaWYgbmVlZGVkXG4qL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpIHtcbiAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IGZhbHNlO1xuICAgIHRoaXMudmlkZW8uY3VycmVudFRpbWUtPTAuMDAwMTtcbiAgICBpZighdGhpcy5wcmV2aW91c2x5UGF1c2VkKSB7XG4gICAgICB0aGlzLnZpZGVvLnBsYXkoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0TGV2ZWxTd2l0Y2goKSB7XG4gICAgLyogdHJ5IHRvIHN3aXRjaCBBU0FQIHdpdGhvdXQgYnJlYWtpbmcgdmlkZW8gcGxheWJhY2sgOlxuICAgICAgIGluIG9yZGVyIHRvIGVuc3VyZSBzbW9vdGggYnV0IHF1aWNrIGxldmVsIHN3aXRjaGluZyxcbiAgICAgIHdlIG5lZWQgdG8gZmluZCB0aGUgbmV4dCBmbHVzaGFibGUgYnVmZmVyIHJhbmdlXG4gICAgICB3ZSBzaG91bGQgdGFrZSBpbnRvIGFjY291bnQgbmV3IHNlZ21lbnQgZmV0Y2ggdGltZVxuICAgICovXG4gICAgdmFyIGZldGNoZGVsYXksY3VycmVudFJhbmdlLG5leHRSYW5nZTtcblxuICAgIGN1cnJlbnRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSk7XG4gICAgaWYoY3VycmVudFJhbmdlKSB7XG4gICAgLy8gZmx1c2ggYnVmZmVyIHByZWNlZGluZyBjdXJyZW50IGZyYWdtZW50IChmbHVzaCB1bnRpbCBjdXJyZW50IGZyYWdtZW50IHN0YXJ0IG9mZnNldClcbiAgICAvLyBtaW51cyAxcyB0byBhdm9pZCB2aWRlbyBmcmVlemluZywgdGhhdCBjb3VsZCBoYXBwZW4gaWYgd2UgZmx1c2gga2V5ZnJhbWUgb2YgY3VycmVudCB2aWRlbyAuLi5cbiAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHsgc3RhcnQgOiAwLCBlbmQgOiBjdXJyZW50UmFuZ2Uuc3RhcnQtMX0pO1xuICAgIH1cblxuICAgIGlmKCF0aGlzLnZpZGVvLnBhdXNlZCkge1xuICAgICAgLy8gYWRkIGEgc2FmZXR5IGRlbGF5IG9mIDFzXG4gICAgICBmZXRjaGRlbGF5PXRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRGZXRjaER1cmF0aW9uKCkrMTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZmV0Y2hkZWxheTonK2ZldGNoZGVsYXkpO1xuICAgIC8vIGZpbmQgYnVmZmVyIHJhbmdlIHRoYXQgd2lsbCBiZSByZWFjaGVkIG9uY2UgbmV3IGZyYWdtZW50IHdpbGwgYmUgZmV0Y2hlZFxuICAgIG5leHRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSArIGZldGNoZGVsYXkpO1xuICAgIGlmKG5leHRSYW5nZSkge1xuICAgICAgLy8gd2UgY2FuIGZsdXNoIGJ1ZmZlciByYW5nZSBmb2xsb3dpbmcgdGhpcyBvbmUgd2l0aG91dCBzdGFsbGluZyBwbGF5YmFja1xuICAgICAgbmV4dFJhbmdlID0gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZShuZXh0UmFuZ2UpO1xuICAgICAgaWYobmV4dFJhbmdlKSB7XG4gICAgICAgIC8vIGZsdXNoIHBvc2l0aW9uIGlzIHRoZSBzdGFydCBwb3NpdGlvbiBvZiB0aGlzIG5ldyBidWZmZXJcbiAgICAgICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goeyBzdGFydCA6IG5leHRSYW5nZS5zdGFydCwgZW5kIDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgIC8vIHRyaWdnZXIgYSBzb3VyY2VCdWZmZXIgZmx1c2hcbiAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLkJVRkZFUl9GTFVTSElORztcbiAgICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25NU0VBdHRhY2hlZChldmVudCxkYXRhKSB7XG4gICAgdGhpcy52aWRlbyA9IGRhdGEudmlkZW87XG4gICAgdGhpcy5tZWRpYVNvdXJjZSA9IGRhdGEubWVkaWFTb3VyY2U7XG4gICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vblZpZGVvU2Vla2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252c2Vla2VkID0gdGhpcy5vblZpZGVvU2Vla2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZtZXRhZGF0YSA9IHRoaXMub25WaWRlb01ldGFkYXRhLmJpbmQodGhpcyk7XG4gICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCdzZWVraW5nJyx0aGlzLm9udnNlZWtpbmcpO1xuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignc2Vla2VkJyx0aGlzLm9udnNlZWtlZCk7XG4gICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsdGhpcy5vbnZtZXRhZGF0YSk7XG4gICAgaWYodGhpcy5sZXZlbHMpIHtcbiAgICAgIHRoaXMuc3RhcnQoKTtcbiAgICB9XG4gIH1cbiAgb25WaWRlb1NlZWtpbmcoKSB7XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gdGhpcy5MT0FESU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50bHkgbG9hZGVkIGZyYWdtZW50IGlzIGluc2lkZSBidWZmZXIuXG4gICAgICAvL2lmIG91dHNpZGUsIGNhbmNlbCBmcmFnbWVudCBsb2FkaW5nLCBvdGhlcndpc2UgZG8gbm90aGluZ1xuICAgICAgaWYodGhpcy5idWZmZXJJbmZvKHRoaXMudmlkZW8uY3VycmVudFRpbWUpLmxlbiA9PT0gMCkge1xuICAgICAgICBsb2dnZXIubG9nKCdzZWVraW5nIG91dHNpZGUgb2YgYnVmZmVyIHdoaWxlIGZyYWdtZW50IGxvYWQgaW4gcHJvZ3Jlc3MsIGNhbmNlbCBmcmFnbWVudCBsb2FkJyk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuSURMRTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lO1xuICAgIH1cbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIHByb2Nlc3NpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uVmlkZW9TZWVrZWQoKSB7XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBGUkFHTUVOVF9QTEFZSU5HIHRyaWdnZXJpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uVmlkZW9NZXRhZGF0YSgpIHtcbiAgICAgIGlmKHRoaXMudmlkZW8uY3VycmVudFRpbWUgIT09IHRoaXMuc3RhcnRQb3NpdGlvbikge1xuICAgICAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgIH1cbiAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gdHJ1ZTtcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMuYXVkaW9jb2RlY3N3aXRjaCA9IGRhdGEuYXVkaW9jb2RlY3N3aXRjaDtcbiAgICBpZih0aGlzLmF1ZGlvY29kZWNzd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBhdWRpbyBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ21lbnRMb2FkZWQgPSBmYWxzZTtcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnN0YXJ0KCk7XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIGZyYWdtZW50cyA9IGRhdGEuZGV0YWlscy5mcmFnbWVudHMsZHVyYXRpb24gPSBkYXRhLmRldGFpbHMudG90YWxkdXJhdGlvbjtcbiAgICBsb2dnZXIubG9nKGBsZXZlbCAke2RhdGEubGV2ZWxJZH0gbG9hZGVkIFske2ZyYWdtZW50c1swXS5zbn0sJHtmcmFnbWVudHNbZnJhZ21lbnRzLmxlbmd0aC0xXS5zbn1dLGR1cmF0aW9uOiR7ZHVyYXRpb259YCk7XG5cbiAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1tkYXRhLmxldmVsSWRdLHNsaWRpbmcgPSAwLCBsZXZlbEN1cnJlbnQgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZCAoaWYgeWVzLCBpdCBzaG91bGQgYmUgYSBsaXZlIHBsYXlsaXN0KVxuICAgIGlmKGxldmVsQ3VycmVudCAmJiBsZXZlbEN1cnJlbnQuZGV0YWlscyAmJiBsZXZlbEN1cnJlbnQuZGV0YWlscy5saXZlKSB7XG4gICAgICB2YXIgb2xkZnJhZ21lbnRzID0gbGV2ZWxDdXJyZW50LmRldGFpbHMuZnJhZ21lbnRzO1xuICAgICAgLy8gIHBsYXlsaXN0IHNsaWRpbmcgaXMgdGhlIHN1bSBvZiA6IGN1cnJlbnQgcGxheWxpc3Qgc2xpZGluZyArIHNsaWRpbmcgb2YgbmV3IHBsYXlsaXN0IGNvbXBhcmVkIHRvIGN1cnJlbnQgb25lXG4gICAgICBzbGlkaW5nID0gbGV2ZWxDdXJyZW50LmRldGFpbHMuc2xpZGluZztcbiAgICAgIC8vIGNoZWNrIHNsaWRpbmcgb2YgdXBkYXRlZCBwbGF5bGlzdCBhZ2FpbnN0IGN1cnJlbnQgb25lIDpcbiAgICAgIC8vIGFuZCBmaW5kIGl0cyBwb3NpdGlvbiBpbiBjdXJyZW50IHBsYXlsaXN0XG4gICAgICAvL2xvZ2dlci5sb2coXCJmcmFnbWVudHNbMF0uc24vdGhpcy5sZXZlbC9sZXZlbEN1cnJlbnQuZGV0YWlscy5mcmFnbWVudHNbMF0uc246XCIgKyBmcmFnbWVudHNbMF0uc24gKyBcIi9cIiArIHRoaXMubGV2ZWwgKyBcIi9cIiArIGxldmVsQ3VycmVudC5kZXRhaWxzLmZyYWdtZW50c1swXS5zbik7XG4gICAgICB2YXIgU05kaWZmID0gZnJhZ21lbnRzWzBdLnNuIC0gb2xkZnJhZ21lbnRzWzBdLnNuO1xuICAgICAgaWYoU05kaWZmID49MCkge1xuICAgICAgICAvLyBwb3NpdGl2ZSBzbGlkaW5nIDogbmV3IHBsYXlsaXN0IHNsaWRpbmcgd2luZG93IGlzIGFmdGVyIHByZXZpb3VzIG9uZVxuICAgICAgICBpZiggU05kaWZmIDwgb2xkZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgIHNsaWRpbmcgKz0gb2xkZnJhZ21lbnRzW1NOZGlmZl0uc3RhcnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgY2Fubm90IGNvbXB1dGUgc2xpZGluZywgbm8gU04gaW4gY29tbW9uIGJldHdlZW4gb2xkL25ldyBsZXZlbDpbJHtvbGRmcmFnbWVudHNbMF0uc259LCR7b2xkZnJhZ21lbnRzW29sZGZyYWdtZW50cy5sZW5ndGgtMV0uc259XS9bJHtmcmFnbWVudHNbMF0uc259LCR7ZnJhZ21lbnRzW2ZyYWdtZW50cy5sZW5ndGgtMV0uc259XWApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBuZWdhdGl2ZSBzbGlkaW5nOiBuZXcgcGxheWxpc3Qgc2xpZGluZyB3aW5kb3cgaXMgYmVmb3JlIHByZXZpb3VzIG9uZVxuICAgICAgICBzbGlkaW5nIC09IGZyYWdtZW50c1stU05kaWZmXS5zdGFydDtcbiAgICAgIH1cbiAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3Qgc2xpZGluZzoke3NsaWRpbmcudG9GaXhlZCgzKX1gKTtcbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgbGV2ZWwgaW5mb1xuICAgIGxldmVsLmRldGFpbHMgPSBkYXRhLmRldGFpbHM7XG4gICAgbGV2ZWwuZGV0YWlscy5zbGlkaW5nID0gc2xpZGluZztcbiAgICB0aGlzLmRlbXV4ZXIuc2V0RHVyYXRpb24oZHVyYXRpb24rc2xpZGluZyk7XG4gICAgaWYodGhpcy5zdGFydExldmVsTG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tM1xuICAgICAgaWYoZGF0YS5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCxkdXJhdGlvbiAtIDMgKiBkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgfVxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gb25seSBzd2l0Y2ggYmF0Y2sgdG8gSURMRSBzdGF0ZSBpZiB3ZSB3ZXJlIHdhaXRpbmcgZm9yIGxldmVsIHRvIHN0YXJ0IGRvd25sb2FkaW5nIGEgbmV3IGZyYWdtZW50XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gdGhpcy5XQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IHRoaXMuTE9BRElORykge1xuICAgICAgaWYodGhpcy5mcmFnbWVudEJpdHJhdGVUZXN0ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgLi4uIHdlIGp1c3QgbG9hZGVkIGEgZnJhZ21lbnQgdG8gZGV0ZXJtaW5lIGFkZXF1YXRlIHN0YXJ0IGJpdHJhdGUgYW5kIGluaXRpYWxpemUgYXV0b3N3aXRjaCBhbGdvXG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9IGZhbHNlO1xuICAgICAgICBkYXRhLnN0YXRzLnRwYXJzZWQgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwgeyBzdGF0cyA6IGRhdGEuc3RhdHMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLlBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSwgZGV0YWlscyA9IGN1cnJlbnRMZXZlbC5kZXRhaWxzLCAgZHVyYXRpb24gPSAgZGV0YWlscy50b3RhbGR1cmF0aW9uO1xuICAgICAgICBpZihkZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICBkdXJhdGlvbis9ZGV0YWlscy5zbGlkaW5nO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGVtdXhlci5zZXREdXJhdGlvbihkdXJhdGlvbik7XG4gICAgICAgIHRoaXMuZGVtdXhlci5wdXNoKGRhdGEucGF5bG9hZCxjdXJyZW50TGV2ZWwuYXVkaW9Db2RlYyxjdXJyZW50TGV2ZWwudmlkZW9Db2RlYyx0aGlzLmZyYWcuc3RhcnQpO1xuICAgICAgfVxuICAgICAgdGhpcy5zdGFydEZyYWdtZW50TG9hZGVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBvbkluaXRTZWdtZW50KGV2ZW50LGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBjb2RlY3MgaGF2ZSBiZWVuIGV4cGxpY2l0ZWx5IGRlZmluZWQgaW4gdGhlIG1hc3RlciBwbGF5bGlzdCBmb3IgdGhpcyBsZXZlbDtcbiAgICAvLyBpZiB5ZXMgdXNlIHRoZXNlIG9uZXMgaW5zdGVhZCBvZiB0aGUgb25lcyBwYXJzZWQgZnJvbSB0aGUgZGVtdXhcbiAgICB2YXIgYXVkaW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS52aWRlb0NvZGVjLHNiO1xuICAgIC8vbG9nZ2VyLmxvZygncGxheWxpc3QgbGV2ZWwgQS9WIGNvZGVjczonICsgYXVkaW9Db2RlYyArICcsJyArIHZpZGVvQ29kZWMpO1xuICAgIC8vbG9nZ2VyLmxvZygncGxheWxpc3QgY29kZWNzOicgKyBjb2RlYyk7XG4gICAgLy8gaWYgcGxheWxpc3QgZG9lcyBub3Qgc3BlY2lmeSBjb2RlY3MsIHVzZSBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudFxuICAgIGlmKGF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCB8fCBkYXRhLmF1ZGlvY29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgYXVkaW9Db2RlYyA9IGRhdGEuYXVkaW9Db2RlYztcbiAgICB9XG4gICAgaWYodmlkZW9Db2RlYyA9PT0gdW5kZWZpbmVkICB8fCBkYXRhLnZpZGVvY29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICB9XG5cbiAgICAvLyBjb2RlYz1cIm1wNGEuNDAuNSxhdmMxLjQyMDAxNlwiO1xuICAgIC8vIGluIGNhc2Ugc2V2ZXJhbCBhdWRpbyBjb2RlY3MgbWlnaHQgYmUgdXNlZCwgZm9yY2UgSEUtQUFDIGZvciBhdWRpbyAoc29tZSBicm93c2VycyBkb24ndCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaClcbiAgICAvL2Rvbid0IGRvIGl0IGZvciBtb25vIHN0cmVhbXMgLi4uXG4gICAgaWYodGhpcy5hdWRpb2NvZGVjc3dpdGNoICYmIGRhdGEuYXVkaW9DaGFubmVsQ291bnQgPT09IDIgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2FuZHJvaWQnKSA9PT0gLTEgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2ZpcmVmb3gnKSA9PT0gLTEpIHtcbiAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICB9XG4gICAgaWYoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IHt9O1xuICAgICAgbG9nZ2VyLmxvZyhgc2VsZWN0ZWQgQS9WIGNvZGVjcyBmb3Igc291cmNlQnVmZmVyczoke2F1ZGlvQ29kZWN9LCR7dmlkZW9Db2RlY31gKTtcbiAgICAgIC8vIGNyZWF0ZSBzb3VyY2UgQnVmZmVyIGFuZCBsaW5rIHRoZW0gdG8gTWVkaWFTb3VyY2VcbiAgICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyA9IHRoaXMubWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKGB2aWRlby9tcDQ7Y29kZWNzPSR7YXVkaW9Db2RlY31gKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgaWYodmlkZW9Db2RlYykge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLnZpZGVvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHt2aWRlb0NvZGVjfWApO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiAnYXVkaW8nLCBkYXRhIDogZGF0YS5hdWRpb01vb3Z9KTtcbiAgICB9XG4gICAgaWYodmlkZW9Db2RlYykge1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6ICd2aWRlbycsIGRhdGEgOiBkYXRhLnZpZGVvTW9vdn0pO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRQYXJzaW5nKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLnRwYXJzZTIgPSBEYXRlLm5vdygpO1xuICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgIGlmKGxldmVsLmRldGFpbHMubGl2ZSkge1xuICAgICAgdmFyIGZyYWdtZW50cyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmRldGFpbHMuZnJhZ21lbnRzO1xuICAgICAgdmFyIHNuMCA9IGZyYWdtZW50c1swXS5zbixzbjEgPSBmcmFnbWVudHNbZnJhZ21lbnRzLmxlbmd0aC0xXS5zbiwgc24gPSB0aGlzLmZyYWcuc247XG4gICAgICAvL3JldHJpZXZlIHRoaXMuZnJhZy5zbiBpbiB0aGlzLmxldmVsc1t0aGlzLmxldmVsXVxuICAgICAgaWYoc24gPj0gc24wICYmIHNuIDw9IHNuMSkge1xuICAgICAgICBsZXZlbC5kZXRhaWxzLnNsaWRpbmcgPSBkYXRhLnN0YXJ0UFRTIC0gZnJhZ21lbnRzW3NuLXNuMF0uc3RhcnQ7XG4gICAgICAgIC8vbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCBzbGlkaW5nOiR7bGV2ZWwuZGV0YWlscy5zbGlkaW5nLnRvRml4ZWQoMyl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGxvZ2dlci5sb2coYCAgICAgIHBhcnNlZCBkYXRhLCB0eXBlL3N0YXJ0UFRTL2VuZFBUUy9zdGFydERUUy9lbmREVFMvbmI6JHtkYXRhLnR5cGV9LyR7ZGF0YS5zdGFydFBUUy50b0ZpeGVkKDMpfS8ke2RhdGEuZW5kUFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5zdGFydERUUy50b0ZpeGVkKDMpfS8ke2RhdGEuZW5kRFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5uYn1gKTtcbiAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogZGF0YS50eXBlLCBkYXRhIDogZGF0YS5tb29mfSk7XG4gICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6IGRhdGEudHlwZSwgZGF0YSA6IGRhdGEubWRhdH0pO1xuICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IGRhdGEuZW5kUFRTO1xuICAgIHRoaXMuYnVmZmVyUmFuZ2UucHVzaCh7dHlwZSA6IGRhdGEudHlwZSwgc3RhcnQgOiBkYXRhLnN0YXJ0UFRTLCBlbmQgOiBkYXRhLmVuZFBUUywgZnJhZyA6IHRoaXMuZnJhZ30pO1xuICAgIC8vIGlmKGRhdGEudHlwZSA9PT0gJ3ZpZGVvJykge1xuICAgIC8vICAgdGhpcy5mcmFnLmZwc0V4cGVjdGVkID0gKGRhdGEubmItMSkgLyAoZGF0YS5lbmRQVFMgLSBkYXRhLnN0YXJ0UFRTKTtcbiAgICAvLyB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkZyYWdtZW50UGFyc2VkKCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuUEFSU0VEO1xuICAgICAgdGhpcy5zdGF0cy50cGFyc2VkID0gbmV3IERhdGUoKTtcbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkRXJyb3IoKSB7XG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGNvbnRyb2xsZXI6IGVycm9yIHdoaWxlIGxvYWRpbmcgZnJhZywgcmV0cnkgLi4uJyk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkVGltZW91dCgpIHtcbiAgICBsb2dnZXIubG9nKCdidWZmZXIgY29udHJvbGxlcjogdGltZW91dCB3aGlsZSBsb2FkaW5nIGZyYWcsIHJldHJ5IC4uLicpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuYWJvcnQoKTtcbiAgICB0aGlzLnN0YXRlID0gdGhpcy5JRExFO1xuICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZCgpIHtcbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICBpZih0aGlzLnN0YXRlID09PSB0aGlzLkFQUEVORElORyAmJiB0aGlzLm1wNHNlZ21lbnRzLmxlbmd0aCA9PT0gMCkgIHtcbiAgICAgIHRoaXMuc3RhdHMudGJ1ZmZlcmVkID0gbmV3IERhdGUoKTtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwgeyBzdGF0cyA6IHRoaXMuc3RhdHMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgIHRoaXMuc3RhdGUgPSB0aGlzLklETEU7XG4gICAgfVxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25Tb3VyY2VCdWZmZXJFcnJvcihldmVudCkge1xuICAgICAgbG9nZ2VyLmxvZyhgc291cmNlQnVmZmVyIGVycm9yOiR7ZXZlbnR9YCk7XG4gICAgICB0aGlzLnN0YXRlID0gdGhpcy5FUlJPUjtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19BUFBFTkRJTkdfRVJST1IsIHtmcmFnIDogdGhpcy5mcmFnfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnVmZmVyQ29udHJvbGxlcjtcbiIsIi8qXG4gKiBsZXZlbCBjb250cm9sbGVyXG4gKlxuICovXG5cbiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5cbiBjbGFzcyBMZXZlbENvbnRyb2xsZXIge1xuXG4gIGNvbnN0cnVjdG9yKHBsYXlsaXN0TG9hZGVyKSB7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IHBsYXlsaXN0TG9hZGVyO1xuICAgIHRoaXMub25tbCA9IHRoaXMub25NYW5pZmVzdExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbCA9IHRoaXMub25GcmFnbWVudExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbGUgPSB0aGlzLm9uRnJhZ21lbnRMb2FkRXJyb3IuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmx0ID0gdGhpcy5vbkZyYWdtZW50TG9hZFRpbWVvdXQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGx0ID0gdGhpcy5vbkxldmVsTG9hZFRpbWVvdXQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGxlID0gdGhpcy5vbkxldmVsTG9hZEVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FEX0VSUk9SLCB0aGlzLm9uZmxlKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURfVElNRU9VVCwgdGhpcy5vbmZsdCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkxFVkVMX0xPQURfRVJST1IsIHRoaXMub25sbGUpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkxFVkVMX0xPQURfVElNRU9VVCwgdGhpcy5vbmxsdCk7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gICAgLy90aGlzLnN0YXJ0TGV2ZWwgPSBzdGFydExldmVsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FEX0VSUk9SLCB0aGlzLm9uZmxlKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX0xPQURfVElNRU9VVCwgdGhpcy5vbmZsdCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkxFVkVMX0xPQURfRVJST1IsIHRoaXMub25sbGUpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkxFVkVMX0xPQURfVElNRU9VVCwgdGhpcy5vbmxsdCk7XG4gICAgaWYodGhpcy50aW1lcikge1xuICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIH1cbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IC0xO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIGxldmVscyA9IFtdLGJpdHJhdGVTdGFydCxpLGJpdHJhdGVTZXQ9e30sIGFhYz1mYWxzZSwgaGVhYWM9ZmFsc2UsY29kZWNzO1xuICAgIGlmKGRhdGEubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgIC8vIHJlbW92ZSBmYWlsb3ZlciBsZXZlbCBmb3Igbm93IHRvIHNpbXBsaWZ5IHRoZSBsb2dpY1xuICAgICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAgIGlmKCFiaXRyYXRlU2V0Lmhhc093blByb3BlcnR5KGxldmVsLmJpdHJhdGUpKSB7XG4gICAgICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVjdCBpZiB3ZSBoYXZlIGRpZmZlcmVudCBraW5kIG9mIGF1ZGlvIGNvZGVjcyB1c2VkIGFtb25nc3QgcGxheWxpc3RzXG4gICAgICAgIGNvZGVjcyA9IGxldmVsLmNvZGVjcztcbiAgICAgICAgaWYoY29kZWNzKSB7XG4gICAgICAgICAgaWYoY29kZWNzLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSkge1xuICAgICAgICAgICAgYWFjID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoY29kZWNzLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkge1xuICAgICAgICAgICAgaGVhYWMgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICAvLyBzdGFydCBiaXRyYXRlIGlzIHRoZSBmaXJzdCBiaXRyYXRlIG9mIHRoZSBtYW5pZmVzdFxuICAgICAgYml0cmF0ZVN0YXJ0ID0gbGV2ZWxzWzBdLmJpdHJhdGU7XG4gICAgICAvLyBzb3J0IGxldmVsIG9uIGJpdHJhdGVcbiAgICAgIGxldmVscy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLmJpdHJhdGUtYi5iaXRyYXRlO1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG5cbiAgICAgIC8vIGZpbmQgaW5kZXggb2YgZmlyc3QgbGV2ZWwgaW4gc29ydGVkIGxldmVsc1xuICAgICAgZm9yKGk9MDsgaSA8IGxldmVscy5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgaWYobGV2ZWxzW2ldLmJpdHJhdGUgPT09IGJpdHJhdGVTdGFydCkge1xuICAgICAgICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBpO1xuICAgICAgICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGxvYWRlZCwke2xldmVscy5sZW5ndGh9IGxldmVsKHMpIGZvdW5kLCBmaXJzdCBiaXRyYXRlOiR7Yml0cmF0ZVN0YXJ0fWApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vdGhpcy5fc3RhcnRMZXZlbCA9IC0xO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiB0aGlzLl9sZXZlbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydExldmVsIDogdGhpcy5fc3RhcnRMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvY29kZWNzd2l0Y2ggOiAoYWFjICYmIGhlYWFjKVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2xldmVscyA9IGRhdGEubGV2ZWxzO1xuICAgICAgdGhpcy5fZmlyc3RMZXZlbCA9IDA7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCxcbiAgICAgICAgICAgICAgICAgICAgICB7IGxldmVscyA6IHRoaXMuX2xldmVscyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0TGV2ZWwgOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXVkaW9jb2RlY3N3aXRjaCA6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWxzO1xuICB9XG5cbiAgZ2V0IGxldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbDtcbiAgfVxuXG4gIHNldCBsZXZlbChuZXdMZXZlbCkge1xuICAgIGlmKHRoaXMuX2xldmVsICE9PSBuZXdMZXZlbCkge1xuICAgICAgdGhpcy5zZXRMZXZlbEludGVybmFsKG5ld0xldmVsKTtcbiAgICB9XG4gIH1cblxuIHNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpIHtcbiAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICBpZihuZXdMZXZlbCA+PSAwICYmIG5ld0xldmVsIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2xldmVsID0gbmV3TGV2ZWw7XG4gICAgICBsb2dnZXIubG9nKGBzd2l0Y2hpbmcgdG8gbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfU1dJVENILCB7IGxldmVsSWQgOiBuZXdMZXZlbH0pO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW25ld0xldmVsXTtcbiAgICAgICAvLyBjaGVjayBpZiB3ZSBuZWVkIHRvIGxvYWQgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWxcbiAgICAgIGlmKGxldmVsLmxvYWRpbmcgPT09IHVuZGVmaW5lZCB8fCAobGV2ZWwuZGV0YWlscyAmJiBsZXZlbC5kZXRhaWxzLmxpdmUgPT09IHRydWUpKSB7XG4gICAgICAgIC8vIGxldmVsIG5vdCByZXRyaWV2ZWQgeWV0LCBvciBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gKHJlKWxvYWQgaXRcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7IGxldmVsSWQgOiBuZXdMZXZlbH0pO1xuICAgICAgICBsb2dnZXIubG9nKGAocmUpbG9hZGluZyBwbGF5bGlzdCBmb3IgbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKGxldmVsLnVybCxuZXdMZXZlbCk7XG4gICAgICAgIGxldmVsLmxvYWRpbmcgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnZhbGlkIGxldmVsIGlkIGdpdmVuLCB0cmlnZ2VyIGVycm9yXG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0VSUk9SLCB7IGxldmVsIDogbmV3TGV2ZWwsIGV2ZW50OiAnaW52YWxpZCBsZXZlbCBpZHgnfSk7XG4gICAgfVxuIH1cblxuXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gIH1cblxuICBzZXQgbWFudWFsTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMubGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gIH1cblxuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIGlmKHRoaXMuX3N0YXJ0TGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGFydExldmVsO1xuICAgIH1cbiAgfVxuXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgb25GcmFnbWVudExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gKHN0YXRzLnRsb2FkIC0gc3RhdHMudHJlcXVlc3QpLzEwMDA7XG4gICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICB0aGlzLmxhc3RidyA9IHN0YXRzLmxlbmd0aCo4L3RoaXMubGFzdGZldGNoZHVyYXRpb247XG4gICAgLy9jb25zb2xlLmxvZyhgbGVuOiR7c3RhdHMubGVuZ3RofSxmZXRjaER1cmF0aW9uOiR7dGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbn0sYnc6JHsodGhpcy5sYXN0YncvMTAwMCkudG9GaXhlZCgwKX1gKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkRXJyb3IoKSB7XG4gICAgbG9nZ2VyLmxvZyhgbGV2ZWwgY29udHJvbGxlcixmcmFnIGxvYWQgZXJyb3I6IGVtZXJnZW5jeSBzd2l0Y2gtZG93biBmb3IgbmV4dCBmcmFnbWVudGApO1xuICAgIHRoaXMubGFzdGJ3ID0gMDtcbiAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gMDtcblxuICB9XG5cbiAgb25GcmFnbWVudExvYWRUaW1lb3V0KCkge1xuICAgIGxvZ2dlci5sb2coYGxldmVsIGNvbnRyb2xsZXIsZnJhZyBsb2FkIHRpbWVvdXQ6IGVtZXJnZW5jeSBzd2l0Y2gtZG93biBmb3IgbmV4dCBmcmFnbWVudGApO1xuICAgIHRoaXMubGFzdGJ3ID0gMDtcbiAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gMDtcbiAgfVxuXG4gIG9uTGV2ZWxMb2FkRXJyb3IoKSB7XG4gICAgbG9nZ2VyLmxvZyhgbGV2ZWwgY29udHJvbGxlcixsZXZlbCBsb2FkIGVycm9yOiB0cnkgdG8gcmVsb2FkIHNhbWUgbGV2ZWxgKTtcbiAgICB0aGlzLl9sZXZlbHNbdGhpcy5fbGV2ZWxdLmxvYWRpbmc9dW5kZWZpbmVkO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIuYWJvcnQoKTtcbiAgICB0aGlzLnNldExldmVsSW50ZXJuYWwodGhpcy5fbGV2ZWwpO1xuICB9XG5cbiAgb25MZXZlbExvYWRUaW1lb3V0KCkge1xuICAgIGxvZ2dlci5sb2coYGxldmVsIGNvbnRyb2xsZXIsbGV2ZWwgbG9hZCB0aW1lb3V0OiB0cnkgdG8gcmVsb2FkIHNhbWUgbGV2ZWxgKTtcbiAgICB0aGlzLl9sZXZlbHNbdGhpcy5fbGV2ZWxdLmxvYWRpbmc9dW5kZWZpbmVkO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIuYWJvcnQoKTtcbiAgICB0aGlzLnNldExldmVsSW50ZXJuYWwodGhpcy5fbGV2ZWwpO1xuICB9XG5cblxuICBvbkxldmVsTG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IHBsYXlsaXN0IGlzIGEgbGl2ZSBwbGF5bGlzdFxuICAgIGlmKGRhdGEuZGV0YWlscy5saXZlICYmICF0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0IHdlIHdpbGwgaGF2ZSB0byByZWxvYWQgaXQgcGVyaW9kaWNhbGx5XG4gICAgICAvLyBzZXQgcmVsb2FkIHBlcmlvZCB0byBwbGF5bGlzdCB0YXJnZXQgZHVyYXRpb25cbiAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9udGljaywgMTAwMCpkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7IGxldmVsSWQgOiB0aGlzLl9sZXZlbH0pO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIubG9hZCh0aGlzLl9sZXZlbHNbdGhpcy5fbGV2ZWxdLnVybCx0aGlzLl9sZXZlbCk7XG4gIH1cblxuICBuZXh0TGV2ZWwoKSB7XG4gICAgaWYodGhpcy5fbWFudWFsTGV2ZWwgIT09IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgcmV0dXJuIHRoaXMubmV4dEF1dG9MZXZlbCgpO1xuICAgIH1cbiAgfVxuXG4gIG5leHRGZXRjaER1cmF0aW9uKCkge1xuICAgIGlmKHRoaXMubGFzdGZldGNoZHVyYXRpb24pIHtcbiAgICAgIHJldHVybiB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uKnRoaXMuX2xldmVsc1t0aGlzLl9sZXZlbF0uYml0cmF0ZS90aGlzLl9sZXZlbHNbdGhpcy5sYXN0ZmV0Y2hsZXZlbF0uYml0cmF0ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICB9XG5cbiAgbmV4dEF1dG9MZXZlbCgpIHtcbiAgICB2YXIgbGFzdGJ3ID0gdGhpcy5sYXN0YncsYWRqdXN0ZWRidyxpLG1heEF1dG9MZXZlbDtcbiAgICBpZih0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID09PSAtMSkge1xuICAgICAgbWF4QXV0b0xldmVsID0gdGhpcy5fbGV2ZWxzLmxlbmd0aC0xO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICAgIH1cbiAgICAvLyBmb2xsb3cgYWxnb3JpdGhtIGNhcHR1cmVkIGZyb20gc3RhZ2VmcmlnaHQgOlxuICAgIC8vIGh0dHBzOi8vYW5kcm9pZC5nb29nbGVzb3VyY2UuY29tL3BsYXRmb3JtL2ZyYW1ld29ya3MvYXYvKy9tYXN0ZXIvbWVkaWEvbGlic3RhZ2VmcmlnaHQvaHR0cGxpdmUvTGl2ZVNlc3Npb24uY3BwXG4gICAgLy8gUGljayB0aGUgaGlnaGVzdCBiYW5kd2lkdGggc3RyZWFtIGJlbG93IG9yIGVxdWFsIHRvIGVzdGltYXRlZCBiYW5kd2lkdGguXG4gICAgZm9yKGkgPTA7IGkgPD0gbWF4QXV0b0xldmVsIDsgaSsrKSB7XG4gICAgLy8gY29uc2lkZXIgb25seSA4MCUgb2YgdGhlIGF2YWlsYWJsZSBiYW5kd2lkdGgsIGJ1dCBpZiB3ZSBhcmUgc3dpdGNoaW5nIHVwLFxuICAgIC8vIGJlIGV2ZW4gbW9yZSBjb25zZXJ2YXRpdmUgKDcwJSkgdG8gYXZvaWQgb3ZlcmVzdGltYXRpbmcgYW5kIGltbWVkaWF0ZWx5XG4gICAgLy8gc3dpdGNoaW5nIGJhY2suXG4gICAgICBpZihpIDw9IHRoaXMuX2xldmVsKSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjgqbGFzdGJ3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuNypsYXN0Ync7XG4gICAgICB9XG4gICAgICBpZihhZGp1c3RlZGJ3IDwgdGhpcy5fbGV2ZWxzW2ldLmJpdHJhdGUpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsaS0xKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGktMTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbENvbnRyb2xsZXI7XG4iLCIgaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IFRTRGVtdXhlciAgICAgICAgICAgIGZyb20gJy4vdHNkZW11eGVyJztcbiBpbXBvcnQgVFNEZW11eGVyV29ya2VyICAgICAgZnJvbSAnLi90c2RlbXV4ZXJ3b3JrZXInO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4gaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cblxuY2xhc3MgRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgaWYoY29uZmlnLmVuYWJsZVdvcmtlciAmJiAodHlwZW9mKFdvcmtlcikgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICBsb2dnZXIubG9nKCdUUyBkZW11eGluZyBpbiB3ZWJ3b3JrZXInKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgd29yayA9IHJlcXVpcmUoJ3dlYndvcmtpZnknKTtcbiAgICAgICAgICB0aGlzLncgPSB3b3JrKFRTRGVtdXhlcldvcmtlcik7XG4gICAgICAgICAgdGhpcy5vbndtc2cgPSB0aGlzLm9uV29ya2VyTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIHRoaXMudy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdpbml0J30pO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ2Vycm9yIHdoaWxlIGluaXRpYWxpemluZyBUU0RlbXV4ZXJXb3JrZXIsIGZhbGxiYWNrIG9uIHJlZ3VsYXIgVFNEZW11eGVyJyk7XG4gICAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IFRTRGVtdXhlcigpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgICB9XG4gICAgICB0aGlzLmRlbXV4SW5pdGlhbGl6ZWQgPSB0cnVlO1xuICB9XG5cbiAgc2V0RHVyYXRpb24obmV3RHVyYXRpb24pIHtcbiAgICBpZih0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdkdXJhdGlvbicgLCBkYXRhIDogbmV3RHVyYXRpb259KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLnNldER1cmF0aW9uKG5ld0R1cmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmKHRoaXMudykge1xuICAgICAgdGhpcy53LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLHRoaXMub253bXNnKTtcbiAgICAgIHRoaXMudy50ZXJtaW5hdGUoKTtcbiAgICAgIHRoaXMudyA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0KSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2UoeyBjbWQgOiAnZGVtdXgnICwgZGF0YSA6IGRhdGEsIGF1ZGlvQ29kZWMgOiBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjOiB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0IDogdGltZU9mZnNldH0sW2RhdGFdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZGF0YSksIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQpO1xuICAgICAgdGhpcy5kZW11eGVyLmVuZCgpO1xuICAgIH1cbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIGlmKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ3N3aXRjaExldmVsJ30pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuc3dpdGNoTGV2ZWwoKTtcbiAgICB9XG4gIH1cblxuICBvbldvcmtlck1lc3NhZ2UoZXYpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdvbldvcmtlck1lc3NhZ2U6JyArIGV2LmRhdGEuZXZlbnQpO1xuICAgIHN3aXRjaChldi5kYXRhLmV2ZW50KSB7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQ6XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgaWYoZXYuZGF0YS5hdWRpb01vb3YpIHtcbiAgICAgICAgICBvYmouYXVkaW9Nb292ID0gbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5hdWRpb01vb3YpO1xuICAgICAgICAgIG9iai5hdWRpb0NvZGVjID0gZXYuZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICAgIG9iai5hdWRpb0NoYW5uZWxDb3VudCA9IGV2LmRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZihldi5kYXRhLnZpZGVvTW9vdikge1xuICAgICAgICAgIG9iai52aWRlb01vb3YgPSBuZXcgVWludDhBcnJheShldi5kYXRhLnZpZGVvTW9vdik7XG4gICAgICAgICAgb2JqLnZpZGVvQ29kZWMgPSBldi5kYXRhLnZpZGVvQ29kZWM7XG4gICAgICAgICAgb2JqLnZpZGVvV2lkdGggPSBldi5kYXRhLnZpZGVvV2lkdGg7XG4gICAgICAgICAgb2JqLnZpZGVvSGVpZ2h0ID0gZXYuZGF0YS52aWRlb0hlaWdodDtcbiAgICAgICAgfVxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIG9iaik7XG4gICAgICBicmVhaztcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0RBVEE6XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgICAgIG1vb2YgOiBuZXcgVWludDhBcnJheShldi5kYXRhLm1vb2YpLFxuICAgICAgICAgIG1kYXQgOiBuZXcgVWludDhBcnJheShldi5kYXRhLm1kYXQpLFxuICAgICAgICAgIHN0YXJ0UFRTIDogZXYuZGF0YS5zdGFydFBUUyxcbiAgICAgICAgICBlbmRQVFMgOiBldi5kYXRhLmVuZFBUUyxcbiAgICAgICAgICBzdGFydERUUyA6IGV2LmRhdGEuc3RhcnREVFMsXG4gICAgICAgICAgZW5kRFRTIDogZXYuZGF0YS5lbmREVFMsXG4gICAgICAgICAgdHlwZSA6IGV2LmRhdGEudHlwZSxcbiAgICAgICAgICBuYiA6IGV2LmRhdGEubmJcbiAgICAgICAgfSk7XG4gICAgICBicmVhaztcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTRUQ6XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBEZW11eGVyO1xuIiwiLyoqXG4gKiBQYXJzZXIgZm9yIGV4cG9uZW50aWFsIEdvbG9tYiBjb2RlcywgYSB2YXJpYWJsZS1iaXR3aWR0aCBudW1iZXIgZW5jb2RpbmdcbiAqIHNjaGVtZSB1c2VkIGJ5IGgyNjQuXG4gKi9cblxuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBFeHBHb2xvbWIge1xuXG4gIGNvbnN0cnVjdG9yKHdvcmtpbmdEYXRhKSB7XG4gICAgdGhpcy53b3JraW5nRGF0YSA9IHdvcmtpbmdEYXRhO1xuICAgIC8vIHRoZSBudW1iZXIgb2YgYnl0ZXMgbGVmdCB0byBleGFtaW5lIGluIHRoaXMud29ya2luZ0RhdGFcbiAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSA9IHRoaXMud29ya2luZ0RhdGEuYnl0ZUxlbmd0aDtcbiAgICAvLyB0aGUgY3VycmVudCB3b3JkIGJlaW5nIGV4YW1pbmVkXG4gICAgdGhpcy53b3JraW5nV29yZCA9IDA7IC8vIDp1aW50XG4gICAgLy8gdGhlIG51bWJlciBvZiBiaXRzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGUgY3VycmVudCB3b3JkXG4gICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLndvcmtpbmdEYXRhLmJ5dGVMZW5ndGggLSB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSxcbiAgICAgIHdvcmtpbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KDQpLFxuICAgICAgYXZhaWxhYmxlQnl0ZXMgPSBNYXRoLm1pbig0LCB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSk7XG5cbiAgICBpZiAoYXZhaWxhYmxlQnl0ZXMgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbm8gYnl0ZXMgYXZhaWxhYmxlJyk7XG4gICAgfVxuXG4gICAgd29ya2luZ0J5dGVzLnNldCh0aGlzLndvcmtpbmdEYXRhLnN1YmFycmF5KHBvc2l0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29ya2luZ1dvcmQgPSBuZXcgRGF0YVZpZXcod29ya2luZ0J5dGVzLmJ1ZmZlcikuZ2V0VWludDMyKDApO1xuXG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLndvcmtpbmdEYXRhIHRoYXQgaGFzIGJlZW4gcHJvY2Vzc2VkXG4gICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA9IGF2YWlsYWJsZUJ5dGVzICogODtcbiAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPiBjb3VudCkge1xuICAgICAgdGhpcy53b3JraW5nV29yZCAgICAgICAgICA8PD0gY291bnQ7XG4gICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlO1xuICAgICAgc2tpcEJ5dGVzID0gY291bnQgPj4gMztcblxuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMud29ya2luZ0J5dGVzQXZhaWxhYmxlIC09IHNraXBCeXRlcztcblxuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuXG4gICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfVxuICB9XG5cbiAgLy8gKHNpemU6aW50KTp1aW50XG4gIHJlYWRCaXRzKHNpemUpIHtcbiAgICB2YXJcbiAgICAgIGJpdHMgPSBNYXRoLm1pbih0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlLCBzaXplKSwgLy8gOnVpbnRcbiAgICAgIHZhbHUgPSB0aGlzLndvcmtpbmdXb3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcblxuICAgIGlmKHNpemUgPjMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cblxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMud29ya2luZ1dvcmQgPDw9IGJpdHM7XG4gICAgfSBlbHNlIGlmICh0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG5cbiAgICBiaXRzID0gc2l6ZSAtIGJpdHM7XG4gICAgaWYgKGJpdHMgPiAwKSB7XG4gICAgICByZXR1cm4gdmFsdSA8PCBiaXRzIHwgdGhpcy5yZWFkQml0cyhiaXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbHU7XG4gICAgfVxuICB9XG5cbiAgLy8gKCk6dWludFxuICBza2lwTGVhZGluZ1plcm9zKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDAgOyBsZWFkaW5nWmVyb0NvdW50IDwgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmtpbmdXb3JkICYgKDB4ODAwMDAwMDAgPj4+IGxlYWRpbmdaZXJvQ291bnQpKSkge1xuICAgICAgICAvLyB0aGUgZmlyc3QgYml0IG9mIHdvcmtpbmcgd29yZCBpcyAxXG4gICAgICAgIHRoaXMud29ya2luZ1dvcmQgPDw9IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gd2UgZXhoYXVzdGVkIHdvcmtpbmdXb3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcFVuc2lnbmVkRXhwR29sb21iKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExlYWRpbmdaZXJvcygpKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcEV4cEdvbG9tYigpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVbnNpZ25lZEV4cEdvbG9tYigpIHtcbiAgICB2YXIgY2x6ID0gdGhpcy5za2lwTGVhZGluZ1plcm9zKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFeHBHb2xvbWIoKSB7XG4gICAgdmFyIHZhbHUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVuc2lnbmVkQnl0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyg4KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBFeHBHb2xvbWIgZGVjb2RlciBwYXN0IGEgc2NhbGluZyBsaXN0LiBUaGUgc2NhbGluZ1xuICAgKiBsaXN0IGlzIG9wdGlvbmFsbHkgdHJhbnNtaXR0ZWQgYXMgcGFydCBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlclxuICAgKiBzZXQgYW5kIGlzIG5vdCByZWxldmFudCB0byB0cmFuc211eGluZy5cbiAgICogQHBhcmFtIGNvdW50IHtudW1iZXJ9IHRoZSBudW1iZXIgb2YgZW50cmllcyBpbiB0aGlzIHNjYWxpbmcgbGlzdFxuICAgKiBAc2VlIFJlY29tbWVuZGF0aW9uIElUVS1UIEguMjY0LCBTZWN0aW9uIDcuMy4yLjEuMS4xXG4gICAqL1xuICBza2lwU2NhbGluZ0xpc3QoY291bnQpIHtcbiAgICB2YXJcbiAgICAgIGxhc3RTY2FsZSA9IDgsXG4gICAgICBuZXh0U2NhbGUgPSA4LFxuICAgICAgaixcbiAgICAgIGRlbHRhU2NhbGU7XG5cbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRXhwR29sb21iKCk7XG4gICAgICAgIG5leHRTY2FsZSA9IChsYXN0U2NhbGUgKyBkZWx0YVNjYWxlICsgMjU2KSAlIDI1NjtcbiAgICAgIH1cblxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU2VxdWVuY2VQYXJhbWV0ZXJTZXQoKSB7XG4gICAgdmFyXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSAwLFxuICAgICAgcHJvZmlsZUlkYyxwcm9maWxlQ29tcGF0aWJpbGl0eSxsZXZlbElkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG5cbiAgICB0aGlzLnJlYWRVbnNpZ25lZEJ5dGUoKTtcbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7IC8vIHByb2ZpbGVfaWRjXG4gICAgcHJvZmlsZUNvbXBhdGliaWxpdHkgPSB0aGlzLnJlYWRCaXRzKDUpOyAvLyBjb25zdHJhaW50X3NldFswLTRdX2ZsYWcsIHUoNSlcbiAgICB0aGlzLnNraXBCaXRzKDMpOyAvLyByZXNlcnZlZF96ZXJvXzNiaXRzIHUoMyksXG4gICAgbGV2ZWxJZGMgPSB0aGlzLnJlYWRVbnNpZ25lZEJ5dGUoKTsgLy9sZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIHNlcV9wYXJhbWV0ZXJfc2V0X2lkXG5cbiAgICAvLyBzb21lIHByb2ZpbGVzIGhhdmUgbW9yZSBvcHRpb25hbCBkYXRhIHdlIGRvbid0IG5lZWRcbiAgICBpZiAocHJvZmlsZUlkYyA9PT0gMTAwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjIgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTQ0KSB7XG4gICAgICB2YXIgY2hyb21hRm9ybWF0SWRjID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGlmIChjaHJvbWFGb3JtYXRJZGMgPT09IDMpIHtcbiAgICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gc2VwYXJhdGVfY29sb3VyX3BsYW5lX2ZsYWdcbiAgICAgIH1cbiAgICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIGJpdF9kZXB0aF9sdW1hX21pbnVzOFxuICAgICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gYml0X2RlcHRoX2Nocm9tYV9taW51czhcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHFwcHJpbWVfeV96ZXJvX3RyYW5zZm9ybV9ieXBhc3NfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19tYXRyaXhfcHJlc2VudF9mbGFnXG4gICAgICAgIHNjYWxpbmdMaXN0Q291bnQgPSAoY2hyb21hRm9ybWF0SWRjICE9PSAzKSA/IDggOiAxMjtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNjYWxpbmdMaXN0Q291bnQ7IGkrKykge1xuICAgICAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbGlzdF9wcmVzZW50X2ZsYWdbIGkgXVxuICAgICAgICAgICAgaWYgKGkgPCA2KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDE2KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBsb2cyX21heF9mcmFtZV9udW1fbWludXM0XG4gICAgdmFyIHBpY09yZGVyQ250VHlwZSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG5cbiAgICBpZiAocGljT3JkZXJDbnRUeXBlID09PSAwKSB7XG4gICAgICB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpOyAvL2xvZzJfbWF4X3BpY19vcmRlcl9jbnRfbHNiX21pbnVzNFxuICAgIH0gZWxzZSBpZiAocGljT3JkZXJDbnRUeXBlID09PSAxKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkZWx0YV9waWNfb3JkZXJfYWx3YXlzX3plcm9fZmxhZ1xuICAgICAgdGhpcy5za2lwRXhwR29sb21iKCk7IC8vIG9mZnNldF9mb3Jfbm9uX3JlZl9waWNcbiAgICAgIHRoaXMuc2tpcEV4cEdvbG9tYigpOyAvLyBvZmZzZXRfZm9yX3RvcF90b19ib3R0b21fZmllbGRcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGU7IGkrKykge1xuICAgICAgICB0aGlzLnNraXBFeHBHb2xvbWIoKTsgLy8gb2Zmc2V0X2Zvcl9yZWZfZnJhbWVbIGkgXVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIG1heF9udW1fcmVmX2ZyYW1lc1xuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGdhcHNfaW5fZnJhbWVfbnVtX3ZhbHVlX2FsbG93ZWRfZmxhZ1xuXG4gICAgcGljV2lkdGhJbk1ic01pbnVzMSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG5cbiAgICBmcmFtZU1ic09ubHlGbGFnID0gdGhpcy5yZWFkQml0cygxKTtcbiAgICBpZiAoZnJhbWVNYnNPbmx5RmxhZyA9PT0gMCkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gbWJfYWRhcHRpdmVfZnJhbWVfZmllbGRfZmxhZ1xuICAgIH1cblxuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRpcmVjdF84eDhfaW5mZXJlbmNlX2ZsYWdcbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIGZyYW1lX2Nyb3BwaW5nX2ZsYWdcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHByb2ZpbGVJZGMgOiBwcm9maWxlSWRjLFxuICAgICAgcHJvZmlsZUNvbXBhdGliaWxpdHkgOiBwcm9maWxlQ29tcGF0aWJpbGl0eSxcbiAgICAgIGxldmVsSWRjIDogbGV2ZWxJZGMsXG4gICAgICB3aWR0aDogKChwaWNXaWR0aEluTWJzTWludXMxICsgMSkgKiAxNikgLSBmcmFtZUNyb3BMZWZ0T2Zmc2V0ICogMiAtIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ICogMixcbiAgICAgIGhlaWdodDogKCgyIC0gZnJhbWVNYnNPbmx5RmxhZykgKiAocGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSArIDEpICogMTYpIC0gKGZyYW1lQ3JvcFRvcE9mZnNldCAqIDIpIC0gKGZyYW1lQ3JvcEJvdHRvbU9mZnNldCAqIDIpXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIEEgc3RyZWFtLWJhc2VkIG1wMnRzIHRvIG1wNCBjb252ZXJ0ZXIuIFRoaXMgdXRpbGl0eSBpcyB1c2VkIHRvXG4gKiBkZWxpdmVyIG1wNHMgdG8gYSBTb3VyY2VCdWZmZXIgb24gcGxhdGZvcm1zIHRoYXQgc3VwcG9ydCBuYXRpdmVcbiAqIE1lZGlhIFNvdXJjZSBFeHRlbnNpb25zLlxuICovXG5cbiBpbXBvcnQgRXZlbnQgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV4cEdvbG9tYiAgICAgICBmcm9tICcuL2V4cC1nb2xvbWInO1xuLy8gaW1wb3J0IEhleCAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9oZXgnO1xuIGltcG9ydCBNUDQgICAgICAgICAgICAgZnJvbSAnLi4vcmVtdXgvbXA0LWdlbmVyYXRvcic7XG4vLyBpbXBvcnQgTVA0SW5zcGVjdCAgICAgIGZyb20gJy4uL3JlbXV4L21wNC1pbnNwZWN0b3InO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFRTRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICB9XG5cbiAgc2V0RHVyYXRpb24obmV3RHVyYXRpb24pIHtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IG5ld0R1cmF0aW9uO1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5wbXRQYXJzZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9wbXRJZCA9IHRoaXMuX2F2Y0lkID0gdGhpcy5fYWFjSWQgPSAtMTtcbiAgICB0aGlzLl9hdmNUcmFjayA9IHt0eXBlIDogJ3ZpZGVvJywgc2VxdWVuY2VOdW1iZXIgOiAwfTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHt0eXBlIDogJ2F1ZGlvJywgc2VxdWVuY2VOdW1iZXIgOiAwfTtcbiAgICB0aGlzLl9hdmNTYW1wbGVzID0gW107XG4gICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSA9IDA7XG4gICAgdGhpcy5fYWFjU2FtcGxlcyA9IFtdO1xuICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsdGltZU9mZnNldCkge1xuICAgIHRoaXMuYXVkaW9Db2RlYyA9IGF1ZGlvQ29kZWM7XG4gICAgdGhpcy52aWRlb0NvZGVjID0gdmlkZW9Db2RlYztcbiAgICB0aGlzLnRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICAgIHZhciBvZmZzZXQ7XG4gICAgZm9yKG9mZnNldCA9IDA7IG9mZnNldCA8IGRhdGEubGVuZ3RoIDsgb2Zmc2V0ICs9IDE4OCkge1xuICAgICAgdGhpcy5fcGFyc2VUU1BhY2tldChkYXRhLG9mZnNldCk7XG4gICAgfVxuICB9XG4gIC8vIGZsdXNoIGFueSBidWZmZXJlZCBkYXRhXG4gIGVuZCgpIHtcbiAgICBpZih0aGlzLl9hdmNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyh0aGlzLl9hdmNEYXRhKSk7XG4gICAgICB0aGlzLl9hdmNEYXRhID0gbnVsbDtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBBVkMgc2FtcGxlczonICsgdGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLl9mbHVzaEFWQ1NhbXBsZXMoKTtcbiAgICB9XG4gICAgaWYodGhpcy5fYWFjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVModGhpcy5fYWFjRGF0YSkpO1xuICAgICAgdGhpcy5fYWFjRGF0YSA9IG51bGw7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQUFDIHNhbXBsZXM6JyArIHRoaXMuX2FhY1NhbXBsZXMubGVuZ3RoKTtcbiAgICBpZih0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBQUNTYW1wbGVzKCk7XG4gICAgfVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNFRCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VUU1BhY2tldChkYXRhLHN0YXJ0KSB7XG4gICAgdmFyIHN0dCxwaWQsYXRmLG9mZnNldDtcbiAgICBpZihkYXRhW3N0YXJ0XSA9PT0gMHg0Nykge1xuICAgICAgc3R0ID0gISEoZGF0YVtzdGFydCsxXSAmIDB4NDApO1xuICAgICAgLy8gcGlkIGlzIGEgMTMtYml0IGZpZWxkIHN0YXJ0aW5nIGF0IHRoZSBsYXN0IGJpdCBvZiBUU1sxXVxuICAgICAgcGlkID0gKChkYXRhW3N0YXJ0KzFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0KzJdO1xuICAgICAgYXRmID0gKGRhdGFbc3RhcnQrM10gJiAweDMwKSA+PiA0O1xuICAgICAgLy8gaWYgYW4gYWRhcHRpb24gZmllbGQgaXMgcHJlc2VudCwgaXRzIGxlbmd0aCBpcyBzcGVjaWZpZWQgYnkgdGhlIGZpZnRoIGJ5dGUgb2YgdGhlIFRTIHBhY2tldCBoZWFkZXIuXG4gICAgICBpZihhdGYgPiAxKSB7XG4gICAgICAgIG9mZnNldCA9IHN0YXJ0KzUrZGF0YVtzdGFydCs0XTtcbiAgICAgICAgLy8gcmV0dXJuIGlmIHRoZXJlIGlzIG9ubHkgYWRhcHRhdGlvbiBmaWVsZFxuICAgICAgICBpZihvZmZzZXQgPT09IChzdGFydCsxODgpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvZmZzZXQgPSBzdGFydCs0O1xuICAgICAgfVxuICAgICAgaWYodGhpcy5wbXRQYXJzZWQpIHtcbiAgICAgICAgaWYocGlkID09PSB0aGlzLl9hdmNJZCkge1xuICAgICAgICAgIGlmKHN0dCkge1xuICAgICAgICAgICAgaWYodGhpcy5fYXZjRGF0YSkge1xuICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyh0aGlzLl9hdmNEYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9hdmNEYXRhID0ge2RhdGE6IFtdLHNpemU6IDB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9hdmNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCxzdGFydCsxODgpKTtcbiAgICAgICAgICB0aGlzLl9hdmNEYXRhLnNpemUrPXN0YXJ0KzE4OC1vZmZzZXQ7XG4gICAgICAgIH0gZWxzZSBpZihwaWQgPT09IHRoaXMuX2FhY0lkKSB7XG4gICAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgICBpZih0aGlzLl9hYWNEYXRhKSB7XG4gICAgICAgICAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKHRoaXMuX2FhY0RhdGEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2FhY0RhdGEgPSB7ZGF0YTogW10sc2l6ZTogMH07XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2FhY0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LHN0YXJ0KzE4OCkpO1xuICAgICAgICAgIHRoaXMuX2FhY0RhdGEuc2l6ZSs9c3RhcnQrMTg4LW9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgb2Zmc2V0ICs9IGRhdGFbb2Zmc2V0XSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYocGlkID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5fcGFyc2VQQVQoZGF0YSxvZmZzZXQpO1xuICAgICAgICB9IGVsc2UgaWYocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgIHRoaXMuX3BhcnNlUE1UKGRhdGEsb2Zmc2V0KTtcbiAgICAgICAgICB0aGlzLnBtdFBhcnNlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLmxvZygncGFyc2luZyBlcnJvcicpO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBBVChkYXRhLG9mZnNldCkge1xuICAgIC8vIHNraXAgdGhlIFBTSSBoZWFkZXIgYW5kIHBhcnNlIHRoZSBmaXJzdCBQTVQgZW50cnlcbiAgICB0aGlzLl9wbXRJZCAgPSAoZGF0YVtvZmZzZXQrMTBdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0KzExXTtcbiAgICAvL2xvZ2dlci5sb2coJ1BNVCBQSUQ6JyAgKyB0aGlzLl9wbXRJZCk7XG4gIH1cblxuICBfcGFyc2VQTVQoZGF0YSxvZmZzZXQpIHtcbiAgICB2YXIgc2VjdGlvbkxlbmd0aCx0YWJsZUVuZCxwcm9ncmFtSW5mb0xlbmd0aCxwaWQ7XG4gICAgc2VjdGlvbkxlbmd0aCA9IChkYXRhW29mZnNldCsxXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCsyXTtcbiAgICB0YWJsZUVuZCA9IG9mZnNldCArIDMgKyBzZWN0aW9uTGVuZ3RoIC0gNDtcbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKGRhdGFbb2Zmc2V0KzEwXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCsxMV07XG5cbiAgICAvLyBhZHZhbmNlIHRoZSBvZmZzZXQgdG8gdGhlIGZpcnN0IGVudHJ5IGluIHRoZSBtYXBwaW5nIHRhYmxlXG4gICAgb2Zmc2V0ICs9IDEyICsgcHJvZ3JhbUluZm9MZW5ndGg7XG4gICAgd2hpbGUgKG9mZnNldCA8IHRhYmxlRW5kKSB7XG4gICAgICBwaWQgPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgICAgc3dpdGNoKGRhdGFbb2Zmc2V0XSkge1xuICAgICAgICAvLyBJU08vSUVDIDEzODE4LTcgQURUUyBBQUMgKE1QRUctMiBsb3dlciBiaXQtcmF0ZSBhdWRpbylcbiAgICAgICAgY2FzZSAweDBmOlxuICAgICAgICAvL2xvZ2dlci5sb2coJ0FBQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2FhY0lkID0gcGlkO1xuICAgICAgICAgIHRoaXMuX2FhY1RyYWNrLmlkID0gcGlkO1xuICAgICAgICBicmVhaztcbiAgICAgICAgLy8gSVRVLVQgUmVjLiBILjI2NCBhbmQgSVNPL0lFQyAxNDQ5Ni0xMCAobG93ZXIgYml0LXJhdGUgdmlkZW8pXG4gICAgICAgIGNhc2UgMHgxYjpcbiAgICAgICAgLy9sb2dnZXIubG9nKCdBVkMgUElEOicgICsgcGlkKTtcbiAgICAgICAgdGhpcy5fYXZjSWQgPSBwaWQ7XG4gICAgICAgIHRoaXMuX2F2Y1RyYWNrLmlkID0gcGlkO1xuICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgbG9nZ2VyLmxvZygndW5rb3duIHN0cmVhbSB0eXBlOicgICsgZGF0YVtvZmZzZXRdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICAvLyBtb3ZlIHRvIHRoZSBuZXh0IHRhYmxlIGVudHJ5XG4gICAgICAvLyBza2lwIHBhc3QgdGhlIGVsZW1lbnRhcnkgc3RyZWFtIGRlc2NyaXB0b3JzLCBpZiBwcmVzZW50XG4gICAgICBvZmZzZXQgKz0gKChkYXRhW29mZnNldCArIDNdICYgMHgwRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgNF0pICsgNTtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VQRVMoc3RyZWFtKSB7XG4gICAgdmFyIGkgPSAwLGZyYWcscGVzRmxhZ3MscGVzUHJlZml4LHBlc0xlbixwZXNIZHJMZW4scGVzRGF0YSxwZXNQdHMscGVzRHRzLHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAvL3JldHJpZXZlIFBUUy9EVFMgZnJvbSBmaXJzdCBmcmFnbWVudFxuICAgIGZyYWcgPSBzdHJlYW0uZGF0YVswXTtcbiAgICBwZXNQcmVmaXggPSAoZnJhZ1swXSA8PCAxNikgKyAoZnJhZ1sxXSA8PCA4KSArIGZyYWdbMl07XG4gICAgaWYocGVzUHJlZml4ID09PSAxKSB7XG4gICAgICBwZXNMZW4gPSAoZnJhZ1s0XSA8PCA4KSArIGZyYWdbNV07XG4gICAgICBwZXNGbGFncyA9IGZyYWdbN107XG4gICAgICBpZiAocGVzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAgIC8vIFBFUyBoZWFkZXIgZGVzY3JpYmVkIGhlcmUgOiBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgICBwZXNQdHMgPSAoZnJhZ1s5XSAmIDB4MEUpIDw8IDI5XG4gICAgICAgICAgfCAoZnJhZ1sxMF0gJiAweEZGKSA8PCAyMlxuICAgICAgICAgIHwgKGZyYWdbMTFdICYgMHhGRSkgPDwgMTRcbiAgICAgICAgICB8IChmcmFnWzEyXSAmIDB4RkYpIDw8ICA3XG4gICAgICAgICAgfCAoZnJhZ1sxM10gJiAweEZFKSA+Pj4gIDE7XG4gICAgICAgIGlmIChwZXNGbGFncyAmIDB4NDApIHtcbiAgICAgICAgICBwZXNEdHMgPSAoZnJhZ1sxNF0gJiAweDBFICkgPDwgMjlcbiAgICAgICAgICAgIHwgKGZyYWdbMTVdICYgMHhGRiApIDw8IDIyXG4gICAgICAgICAgICB8IChmcmFnWzE2XSAmIDB4RkUgKSA8PCAxNFxuICAgICAgICAgICAgfCAoZnJhZ1sxN10gJiAweEZGICkgPDwgN1xuICAgICAgICAgICAgfCAoZnJhZ1sxOF0gJiAweEZFICkgPj4+IDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVzRHRzID0gcGVzUHRzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwZXNIZHJMZW4gPSBmcmFnWzhdO1xuICAgICAgcGF5bG9hZFN0YXJ0T2Zmc2V0ID0gcGVzSGRyTGVuKzk7XG4gICAgICAvLyB0cmltIFBFUyBoZWFkZXJcbiAgICAgIHN0cmVhbS5kYXRhWzBdID0gc3RyZWFtLmRhdGFbMF0uc3ViYXJyYXkocGF5bG9hZFN0YXJ0T2Zmc2V0KTtcbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgLy8gcmVhc3NlbWJsZSB0aGUgcGFja2V0XG4gICAgICB3aGlsZSAoc3RyZWFtLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBzdHJlYW0uZGF0YS5zaGlmdCgpO1xuICAgICAgICBwZXNEYXRhLnNldChmcmFnLCBpKTtcbiAgICAgICAgaSArPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4geyBkYXRhIDogcGVzRGF0YSwgcHRzIDogcGVzUHRzLCBkdHMgOiBwZXNEdHMsIGxlbiA6IHBlc0xlbn07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZUFWQ1BFUyhwZXMpIHtcbiAgICB2YXIgdW5pdHMsdHJhY2sgPSB0aGlzLl9hdmNUcmFjayxhdmNTYW1wbGUsa2V5ID0gZmFsc2U7XG4gICAgdW5pdHMgPSB0aGlzLl9wYXJzZUFWQ05BTHUocGVzLmRhdGEpO1xuICAgIC8vZnJlZSBwZXMuZGF0YSB0byBzYXZlIHVwIHNvbWUgbWVtb3J5XG4gICAgcGVzLmRhdGEgPSBudWxsO1xuICAgIHVuaXRzLnVuaXRzLmZvckVhY2godW5pdCA9PiB7XG4gICAgICBzd2l0Y2godW5pdC50eXBlKSB7XG4gICAgICAgIC8vSURSXG4gICAgICAgIGNhc2UgNTpcbiAgICAgICAgICBrZXkgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NQU1xuICAgICAgICBjYXNlIDc6XG4gICAgICAgICAgaWYoIXRyYWNrLnNwcykge1xuICAgICAgICAgICAgdmFyIGV4cEdvbG9tYkRlY29kZXIgPSBuZXcgRXhwR29sb21iKHVuaXQuZGF0YSk7XG4gICAgICAgICAgICB2YXIgY29uZmlnID0gZXhwR29sb21iRGVjb2Rlci5yZWFkU2VxdWVuY2VQYXJhbWV0ZXJTZXQoKTtcbiAgICAgICAgICAgIHRyYWNrLndpZHRoID0gY29uZmlnLndpZHRoO1xuICAgICAgICAgICAgdHJhY2suaGVpZ2h0ID0gY29uZmlnLmhlaWdodDtcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVJZGMgPSBjb25maWcucHJvZmlsZUlkYztcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXRpYmlsaXR5ID0gY29uZmlnLnByb2ZpbGVDb21wYXRpYmlsaXR5O1xuICAgICAgICAgICAgdHJhY2subGV2ZWxJZGMgPSBjb25maWcubGV2ZWxJZGM7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLmR1cmF0aW9uID0gOTAwMDAqdGhpcy5fZHVyYXRpb247XG4gICAgICAgICAgICB2YXIgY29kZWNhcnJheSA9IHVuaXQuZGF0YS5zdWJhcnJheSgxLDQpO1xuICAgICAgICAgICAgdmFyIGNvZGVjc3RyaW5nICA9ICdhdmMxLic7XG4gICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGggPSBjb2RlY2FycmF5W2ldLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgICAgICAgICBpZiAoaC5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICAgICAgICAgIGggPSAnMCcgKyBoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlY3N0cmluZyArPSBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJhY2suY29kZWMgPSBjb2RlY3N0cmluZztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vUFBTXG4gICAgICAgIGNhc2UgODpcbiAgICAgICAgICBpZighdHJhY2sucHBzKSB7XG4gICAgICAgICAgICB0cmFjay5wcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy9idWlsZCBzYW1wbGUgZnJvbSBQRVNcbiAgICAvLyBBbm5leCBCIHRvIE1QNCBjb252ZXJzaW9uIHRvIGJlIGRvbmVcbiAgICBhdmNTYW1wbGUgPSB7IHVuaXRzIDogdW5pdHMsIHB0cyA6IHBlcy5wdHMsIGR0cyA6IHBlcy5kdHMgLCBrZXkgOiBrZXl9O1xuICAgIHRoaXMuX2F2Y1NhbXBsZXMucHVzaChhdmNTYW1wbGUpO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggKz0gdW5pdHMubGVuZ3RoO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgKz0gdW5pdHMudW5pdHMubGVuZ3RoO1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZighdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVJbml0U2VnbWVudCgpO1xuICAgIH1cbiAgfVxuXG5cbiAgX2ZsdXNoQVZDU2FtcGxlcygpIHtcbiAgICB2YXIgdmlldyxpPTgsYXZjU2FtcGxlLG1wNFNhbXBsZSxtcDRTYW1wbGVMZW5ndGgsdW5pdCx0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICBsYXN0U2FtcGxlRFRTLG1kYXQsbW9vZixmaXJzdFBUUyxmaXJzdERUUyxzYW1wbGVzID0gW107XG5cbiAgICAvKiBjb25jYXRlbmF0ZSB0aGUgdmlkZW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1wZGF0IHR5cGUpICovXG4gICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggKyAoNCAqIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUpKzgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsbWRhdC5ieXRlTGVuZ3RoKTtcbiAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCw0KTtcbiAgICB3aGlsZSh0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgYXZjU2FtcGxlID0gdGhpcy5fYXZjU2FtcGxlcy5zaGlmdCgpO1xuICAgICAgbXA0U2FtcGxlTGVuZ3RoID0gMDtcblxuICAgICAgLy8gY29udmVydCBOQUxVIGJpdHN0cmVhbSB0byBNUDQgZm9ybWF0IChwcmVwZW5kIE5BTFUgd2l0aCBzaXplIGZpZWxkKVxuICAgICAgd2hpbGUoYXZjU2FtcGxlLnVuaXRzLnVuaXRzLmxlbmd0aCkge1xuICAgICAgICB1bml0ID0gYXZjU2FtcGxlLnVuaXRzLnVuaXRzLnNoaWZ0KCk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKGksIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgaSArPSA0O1xuICAgICAgICBtZGF0LnNldCh1bml0LmRhdGEsIGkpO1xuICAgICAgICBpICs9IHVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgICBtcDRTYW1wbGVMZW5ndGgrPTQrdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG5cbiAgICAgIGF2Y1NhbXBsZS5wdHMgLT0gdGhpcy5faW5pdERUUztcbiAgICAgIGF2Y1NhbXBsZS5kdHMgLT0gdGhpcy5faW5pdERUUztcbiAgICAgIC8vbG9nZ2VyLmxvZygnVmlkZW8vUFRTL0RUUzonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMpO1xuXG4gICAgICBpZihsYXN0U2FtcGxlRFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gYXZjU2FtcGxlLmR0cyAtIGxhc3RTYW1wbGVEVFM7XG4gICAgICAgIGlmKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gY2hlY2sgaWYgZnJhZ21lbnRzIGFyZSBjb250aWd1b3VzIChpLmUuIG5vIG1pc3NpbmcgZnJhbWVzIGJldHdlZW4gZnJhZ21lbnQpXG4gICAgICAgIGlmKHRoaXMubmV4dEF2Y1B0cykge1xuICAgICAgICAgIHZhciBkZWx0YSA9IChhdmNTYW1wbGUucHRzIC0gdGhpcy5uZXh0QXZjUHRzKS85MCxhYnNkZWx0YT1NYXRoLmFicyhkZWx0YSk7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYnNkZWx0YS9hdmNTYW1wbGUucHRzOicgKyBhYnNkZWx0YSArICcvJyArIGF2Y1NhbXBsZS5wdHMpO1xuICAgICAgICAgIC8vIGlmIGRlbHRhIGlzIGxlc3MgdGhhbiAzMDAgbXMsIG5leHQgbG9hZGVkIGZyYWdtZW50IGlzIGFzc3VtZWQgdG8gYmUgY29udGlndW91cyB3aXRoIGxhc3Qgb25lXG4gICAgICAgICAgaWYoYWJzZGVsdGEgPCAzMDApIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnVmlkZW8gbmV4dCBQVFM6JyArIHRoaXMubmV4dEF2Y1B0cyk7XG4gICAgICAgICAgICBpZihkZWx0YSA+IDEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7ZGVsdGEudG9GaXhlZCgwKX0gbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlbHRhIDwgLTEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7KC1kZWx0YS50b0ZpeGVkKDApKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBQVFMgdG8gbmV4dCBQVFNcbiAgICAgICAgICAgIGF2Y1NhbXBsZS5wdHMgPSB0aGlzLm5leHRBdmNQdHM7XG4gICAgICAgICAgICAvLyBvZmZzZXQgRFRTIGFzIHdlbGwsIGVuc3VyZSB0aGF0IERUUyBpcyBzbWFsbGVyIG9yIGVxdWFsIHRoYW4gbmV3IFBUU1xuICAgICAgICAgICAgYXZjU2FtcGxlLmR0cyA9IE1hdGgubWF4KGF2Y1NhbXBsZS5kdHMtZGVsdGEsIHRoaXMubGFzdEF2Y0R0cyk7XG4gICAgICAgICAgIC8vIGxvZ2dlci5sb2coJ1ZpZGVvL1BUUy9EVFMgYWRqdXN0ZWQ6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhdmNTYW1wbGVzLCBlbnN1cmUgdmFsdWUgaXMgcG9zaXRpdmVcbiAgICAgICAgZmlyc3RQVFMgPSBNYXRoLm1heCgwLGF2Y1NhbXBsZS5wdHMpO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsYXZjU2FtcGxlLmR0cyk7XG4gICAgICB9XG5cbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogbXA0U2FtcGxlTGVuZ3RoLFxuICAgICAgICBjb21wb3NpdGlvblRpbWVPZmZzZXQ6IGF2Y1NhbXBsZS5wdHMgLSBhdmNTYW1wbGUuZHRzLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRhdGlvblByaW9yaXR5OiAwXG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGlmKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jU2FtcGxlID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jU2FtcGxlID0gMTtcbiAgICAgIH1cbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdFNhbXBsZURUUyA9IGF2Y1NhbXBsZS5kdHM7XG4gICAgfVxuICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGgtMl0uZHVyYXRpb247XG4gICAgdGhpcy5sYXN0QXZjRHRzID0gYXZjU2FtcGxlLmR0cztcbiAgICAvLyBuZXh0IEFWQyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgIHRoaXMubmV4dEF2Y1B0cyA9IGF2Y1NhbXBsZS5wdHMgKyBtcDRTYW1wbGUuZHVyYXRpb247XG4gICAgLy9sb2dnZXIubG9nKCdWaWRlby9sYXN0QXZjRHRzL25leHRBdmNQdHM6JyArIHRoaXMubGFzdEF2Y0R0cyArICcvJyArIHRoaXMubmV4dEF2Y1B0cyk7XG5cbiAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1ID0gMDtcblxuICAgIHRyYWNrLnNhbXBsZXMgPSBzYW1wbGVzO1xuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLGZpcnN0RFRTLHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICBtb29mOiBtb29mLFxuICAgICAgbWRhdDogbWRhdCxcbiAgICAgIHN0YXJ0UFRTIDogZmlyc3RQVFMvOTAwMDAsXG4gICAgICBlbmRQVFMgOiB0aGlzLm5leHRBdmNQdHMvOTAwMDAsXG4gICAgICBzdGFydERUUyA6IGZpcnN0RFRTLzkwMDAwLFxuICAgICAgZW5kRFRTIDogKGF2Y1NhbXBsZS5kdHMgKyBtcDRTYW1wbGUuZHVyYXRpb24pLzkwMDAwLFxuICAgICAgdHlwZSA6ICd2aWRlbycsXG4gICAgICBuYiA6IHNhbXBsZXMubGVuZ3RoXG4gICAgfSk7XG4gIH1cblxuICBfcGFyc2VBVkNOQUx1KGFycmF5KSB7XG4gICAgdmFyIGkgPSAwLGxlbiA9IGFycmF5LmJ5dGVMZW5ndGgsdmFsdWUsb3ZlcmZsb3csc3RhdGUgPSAwO1xuICAgIHZhciB1bml0cyA9IFtdLCB1bml0LCB1bml0VHlwZSwgbGFzdFVuaXRTdGFydCxsYXN0VW5pdFR5cGUsbGVuZ3RoID0gMDtcbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoYXJyYXkpKTtcblxuICAgIHdoaWxlKGk8IGxlbikge1xuICAgICAgdmFsdWUgPSBhcnJheVtpKytdO1xuICAgICAgLy8gZmluZGluZyAzIG9yIDQtYnl0ZSBzdGFydCBjb2RlcyAoMDAgMDAgMDEgT1IgMDAgMDAgMDAgMDEpXG4gICAgICBzd2l0Y2goc3RhdGUpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgIGlmKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYodmFsdWUgPT09IDEpIHtcbiAgICAgICAgICAgIHVuaXRUeXBlID0gYXJyYXlbaV0gJiAweDFmO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIE5BTFUgQCBvZmZzZXQ6JyArIGkgKyAnLHR5cGU6JyArIHVuaXRUeXBlKTtcbiAgICAgICAgICAgIGlmKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgICAgICAgICAgdW5pdCA9IHsgZGF0YSA6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsaS1zdGF0ZS0xKSwgdHlwZSA6IGxhc3RVbml0VHlwZX07XG4gICAgICAgICAgICAgIGxlbmd0aCs9aS1zdGF0ZS0xLWxhc3RVbml0U3RhcnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIE5BTCB1bml0cyBhcmUgbm90IHN0YXJ0aW5nIHJpZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYWNrZXQsIHB1c2ggcHJlY2VkaW5nIGRhdGEgaW50byBwcmV2aW91cyBOQUwgdW5pdC5cbiAgICAgICAgICAgICAgb3ZlcmZsb3cgID0gaSAtIHN0YXRlIC0gMTtcbiAgICAgICAgICAgICAgaWYgKG92ZXJmbG93KSB7XG4gICAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpcnN0IE5BTFUgZm91bmQgd2l0aCBvdmVyZmxvdzonICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgaWYodGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzW3RoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoLTFdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoLTFdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoK292ZXJmbG93KTtcbiAgICAgICAgICAgICAgICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLDApO1xuICAgICAgICAgICAgICAgICAgICB0bXAuc2V0KGFycmF5LnN1YmFycmF5KDAsb3ZlcmZsb3cpLGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RVbml0LmRhdGEgPSB0bXA7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoKz1vdmVyZmxvdztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCs9b3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxhc3RVbml0U3RhcnQgPSBpO1xuICAgICAgICAgICAgbGFzdFVuaXRUeXBlID0gdW5pdFR5cGU7XG4gICAgICAgICAgICBpZih1bml0VHlwZSA9PT0gMSB8fCB1bml0VHlwZSA9PT0gNSkge1xuICAgICAgICAgICAgICAvLyBPUFRJICEhISBpZiBJRFIvTkRSIHVuaXQsIGNvbnNpZGVyIGl0IGlzIGxhc3QgTkFMdVxuICAgICAgICAgICAgICBpID0gbGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICB1bml0ID0geyBkYXRhIDogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCxsZW4pLCB0eXBlIDogbGFzdFVuaXRUeXBlfTtcbiAgICAgIGxlbmd0aCs9bGVuLWxhc3RVbml0U3RhcnQ7XG4gICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4geyB1bml0cyA6IHVuaXRzICwgbGVuZ3RoIDogbGVuZ3RofTtcbiAgfVxuXG4gIF9wYXJzZUFBQ1BFUyhwZXMpIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxhYWNTYW1wbGUsZGF0YSA9IHBlcy5kYXRhLGNvbmZpZyxhZHRzRnJhbWVTaXplLGFkdHNTdGFydE9mZnNldCxhZHRzSGVhZGVyTGVuLHN0YW1wLGk7XG4gICAgaWYodGhpcy5hYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KHRoaXMuYWFjT3ZlckZsb3cuYnl0ZUxlbmd0aCtkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldCh0aGlzLmFhY092ZXJGbG93LDApO1xuICAgICAgdG1wLnNldChkYXRhLHRoaXMuYWFjT3ZlckZsb3cuYnl0ZUxlbmd0aCk7XG4gICAgICBkYXRhID0gdG1wO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoZGF0YSkpO1xuICAgIGlmKGRhdGFbMF0gPT09IDB4ZmYpIHtcbiAgICAgIGlmKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgICAgY29uZmlnID0gdGhpcy5fQURUU3RvQXVkaW9Db25maWcocGVzLmRhdGEsdGhpcy5hdWRpb0NvZGVjKTtcbiAgICAgICAgdHJhY2suY29uZmlnID0gY29uZmlnLmNvbmZpZztcbiAgICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICAgIHRyYWNrLmNvZGVjID0gY29uZmlnLmNvZGVjO1xuICAgICAgICB0cmFjay5kdXJhdGlvbiA9IDkwMDAwKnRoaXMuX2R1cmF0aW9uO1xuICAgICAgICBjb25zb2xlLmxvZyhgcGFyc2VkICAgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICAgIH1cbiAgICAgIGFkdHNTdGFydE9mZnNldCA9IGkgPSAwO1xuICAgICAgd2hpbGUoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCszXSAmIDB4MDMpIDw8IDExKTtcbiAgICAgICAgLy8gYnl0ZSA0XG4gICAgICAgIGFkdHNGcmFtZVNpemUgfD0gKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzRdIDw8IDMpO1xuICAgICAgICAvLyBieXRlIDVcbiAgICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgICBhZHRzSGVhZGVyTGVuID0gKCEhKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICAgIGFkdHNGcmFtZVNpemUgLT0gYWR0c0hlYWRlckxlbjtcbiAgICAgICAgc3RhbXAgPSBwZXMucHRzICsgaSoxMDI0KjkwMDAwL3RyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ0FBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC9wdHM6JyArIChhZHRzU3RhcnRPZmZzZXQrNykgKyAnLycgKyBhZHRzRnJhbWVTaXplICsgJy8nICsgc3RhbXAudG9GaXhlZCgwKSk7XG4gICAgICAgIGlmKGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuK2FkdHNGcmFtZVNpemUgPD0gZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICBhYWNTYW1wbGUgPSB7IHVuaXQgOiBkYXRhLnN1YmFycmF5KGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuLGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuK2FkdHNGcmFtZVNpemUpICwgcHRzIDogc3RhbXAsIGR0cyA6IHN0YW1wfTtcbiAgICAgICAgICB0aGlzLl9hYWNTYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoICs9IGFkdHNGcmFtZVNpemU7XG4gICAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0Kz1hZHRzRnJhbWVTaXplK2FkdHNIZWFkZXJMZW47XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0VSUk9SLCdTdHJlYW0gZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZighdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVJbml0U2VnbWVudCgpO1xuICAgIH1cbiAgICBpZihhZHRzU3RhcnRPZmZzZXQgPCBkYXRhLmxlbmd0aCkge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0LGRhdGEubGVuZ3RoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgX2ZsdXNoQUFDU2FtcGxlcygpIHtcbiAgICB2YXIgdmlldyxpPTgsYWFjU2FtcGxlLG1wNFNhbXBsZSx1bml0LHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGxhc3RTYW1wbGVEVFMsbWRhdCxtb29mLGZpcnN0UFRTLGZpcnN0RFRTLHNhbXBsZXMgPSBbXTtcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYWFjU2FtcGxlc0xlbmd0aCs4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsNCk7XG4gICAgd2hpbGUodGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHRoaXMuX2FhY1NhbXBsZXMuc2hpZnQoKTtcbiAgICAgIHVuaXQgPSBhYWNTYW1wbGUudW5pdDtcbiAgICAgIG1kYXQuc2V0KHVuaXQsIGkpO1xuICAgICAgaSArPSB1bml0LmJ5dGVMZW5ndGg7XG5cbiAgICAgIGFhY1NhbXBsZS5wdHMgLT0gdGhpcy5faW5pdERUUztcbiAgICAgIGFhY1NhbXBsZS5kdHMgLT0gdGhpcy5faW5pdERUUztcblxuICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFM6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSk7XG4gICAgICBpZihsYXN0U2FtcGxlRFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gd2UgdXNlIERUUyB0byBjb21wdXRlIHNhbXBsZSBkdXJhdGlvbiwgYnV0IHdlIHVzZSBQVFMgdG8gY29tcHV0ZSBpbml0UFRTIHdoaWNoIGlzIHVzZWQgdG8gc3luYyBhdWRpbyBhbmQgdmlkZW9cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gYWFjU2FtcGxlLmR0cyAtIGxhc3RTYW1wbGVEVFM7XG4gICAgICAgIGlmKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gY2hlY2sgaWYgZnJhZ21lbnRzIGFyZSBjb250aWd1b3VzIChpLmUuIG5vIG1pc3NpbmcgZnJhbWVzIGJldHdlZW4gZnJhZ21lbnQpXG4gICAgICAgIGlmKHRoaXMubmV4dEFhY1B0cyAmJiB0aGlzLm5leHRBYWNQdHMgIT09IGFhY1NhbXBsZS5wdHMpIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvIG5leHQgUFRTOicgKyB0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICAgIHZhciBkZWx0YSA9IChhYWNTYW1wbGUucHRzIC0gdGhpcy5uZXh0QWFjUHRzKS85MDtcbiAgICAgICAgICAvLyBpZiBkZWx0YSBpcyBsZXNzIHRoYW4gMzAwIG1zLCBuZXh0IGxvYWRlZCBmcmFnbWVudCBpcyBhc3N1bWVkIHRvIGJlIGNvbnRpZ3VvdXMgd2l0aCBsYXN0IG9uZVxuICAgICAgICAgIGlmKE1hdGguYWJzKGRlbHRhKSA+IDEgJiYgTWF0aC5hYnMoZGVsdGEpIDwgMzAwKSB7XG4gICAgICAgICAgICBpZihkZWx0YSA+IDApIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnQUFDOicgKyBkZWx0YS50b0ZpeGVkKDApICsgJyBtcyBob2xlIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkLGZpbGxpbmcgaXQnKTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IFBUUywgYW5kIGVuc3VyZSBQVFMgaXMgZ3JlYXRlciBvciBlcXVhbCB0aGFuIGxhc3QgRFRTXG4gICAgICAgICAgICAgIGFhY1NhbXBsZS5wdHMgPSBNYXRoLm1heCh0aGlzLm5leHRBYWNQdHMsIHRoaXMubGFzdEFhY0R0cyk7XG4gICAgICAgICAgICAgIGFhY1NhbXBsZS5kdHMgPSBhYWNTYW1wbGUucHRzO1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9EVFMgYWRqdXN0ZWQ6JyArIGFhY1NhbXBsZS5wdHMgKyAnLycgKyBhYWNTYW1wbGUuZHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coJ0FBQzonICsgKC1kZWx0YS50b0ZpeGVkKDApKSArICcgbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhYWNTYW1wbGVzLCBlbnN1cmUgdmFsdWUgaXMgcG9zaXRpdmVcbiAgICAgICAgZmlyc3RQVFMgPSBNYXRoLm1heCgwLGFhY1NhbXBsZS5wdHMpO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsYWFjU2FtcGxlLmR0cyk7XG4gICAgICB9XG5cbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogdW5pdC5ieXRlTGVuZ3RoLFxuICAgICAgICBjb21wb3NpdGlvblRpbWVPZmZzZXQ6IDAsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZGF0aW9uUHJpb3JpdHk6IDAsXG4gICAgICAgICAgZGVwZW5kc09uIDogMSxcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdFNhbXBsZURUUyA9IGFhY1NhbXBsZS5kdHM7XG4gICAgfVxuICAgIC8vc2V0IGxhc3Qgc2FtcGxlIGR1cmF0aW9uIGFzIGJlaW5nIGlkZW50aWNhbCB0byBwcmV2aW91cyBzYW1wbGVcbiAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoLTJdLmR1cmF0aW9uO1xuICAgIHRoaXMubGFzdEFhY0R0cyA9IGFhY1NhbXBsZS5kdHM7XG4gICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBYWNQdHMgPSBhYWNTYW1wbGUucHRzICsgbXA0U2FtcGxlLmR1cmF0aW9uO1xuICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8vUFRTL1BUU2VuZDonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApICsgJy8nICsgdGhpcy5uZXh0QWFjRHRzLnRvRml4ZWQoMCkpO1xuXG4gICAgdGhpcy5fYWFjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssZmlyc3REVFMsdHJhY2spO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFMgOiBmaXJzdFBUUy85MDAwMCxcbiAgICAgIGVuZFBUUyA6IHRoaXMubmV4dEFhY1B0cy85MDAwMCxcbiAgICAgIHN0YXJ0RFRTIDogZmlyc3REVFMvOTAwMDAsXG4gICAgICBlbmREVFMgOiAoYWFjU2FtcGxlLmR0cyArIG1wNFNhbXBsZS5kdXJhdGlvbikvOTAwMDAsXG4gICAgICB0eXBlIDogJ2F1ZGlvJyxcbiAgICAgIG5iIDogc2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIF9BRFRTdG9BdWRpb0NvbmZpZyhkYXRhLGF1ZGlvQ29kZWMpIHtcbiAgICB2YXIgYWR0c09iamVjdFR5cGUsIC8vIDppbnRcbiAgICAgICAgYWR0c1NhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzQ2hhbmVsQ29uZmlnLCAvLyA6aW50XG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgdXNlckFnZW50ID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLFxuICAgICAgICBhZHRzU2FtcGxlaW5nUmF0ZXMgPSBbXG4gICAgICAgICAgICA5NjAwMCwgODgyMDAsXG4gICAgICAgICAgICA2NDAwMCwgNDgwMDAsXG4gICAgICAgICAgICA0NDEwMCwgMzIwMDAsXG4gICAgICAgICAgICAyNDAwMCwgMjIwNTAsXG4gICAgICAgICAgICAxNjAwMCwgMTIwMDBcbiAgICAgICAgICBdO1xuXG4gICAgLy8gYnl0ZSAyXG4gICAgYWR0c09iamVjdFR5cGUgPSAoKGRhdGFbMl0gJiAweEMwKSA+Pj4gNikgKyAxO1xuICAgIGFkdHNTYW1wbGVpbmdJbmRleCA9ICgoZGF0YVsyXSAmIDB4M0MpID4+PiAyKTtcbiAgICBhZHRzQ2hhbmVsQ29uZmlnID0gKChkYXRhWzJdICYgMHgwMSkgPDwgMik7XG4gICAgLy8gYnl0ZSAzXG4gICAgYWR0c0NoYW5lbENvbmZpZyB8PSAoKGRhdGFbM10gJiAweEMwKSA+Pj4gNik7XG5cbiAgICBjb25zb2xlLmxvZyhgbWFuaWZlc3QgY29kZWM6JHthdWRpb0NvZGVjfSxBRFRTIGRhdGE6dHlwZToke2FkdHNPYmplY3RUeXBlfSxzYW1wbGVpbmdJbmRleDoke2FkdHNTYW1wbGVpbmdJbmRleH1bJHthZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XX1rSHpdLGNoYW5uZWxDb25maWc6JHthZHRzQ2hhbmVsQ29uZmlnfWApO1xuXG5cbiAgICAvLyBmaXJlZm94OiBmcmVxIGxlc3MgdGhhbiAyNGtIeiA9IEFBQyBTQlIgKEhFLUFBQylcbiAgICBpZih1c2VyQWdlbnQuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSkge1xuICAgICAgaWYoYWR0c1NhbXBsZWluZ0luZGV4ID49Nikge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleC0zO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICAgIC8vIEFuZHJvaWQgOiBhbHdheXMgdXNlIEFBQ1xuICAgIH0gZWxzZSBpZih1c2VyQWdlbnQuaW5kZXhPZignYW5kcm9pZCcpICE9PSAtMSkge1xuICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgIH0gZWxzZSB7XG4gICAgICAvKiAgZm9yIG90aGVyIGJyb3dzZXJzIChjaHJvbWUgLi4uKVxuICAgICAgICAgIGFsd2F5cyBmb3JjZSBhdWRpbyB0eXBlIHRvIGJlIEhFLUFBQyBTQlIsIGFzIHNvbWUgYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoIHByb3Blcmx5IChsaWtlIENocm9tZSAuLi4pXG4gICAgICAqL1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgSEUtQUFDKSBPUiAobWFuaWZlc3QgY29kZWMgbm90IHNwZWNpZmllZCBBTkQgZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeilcbiAgICAgIGlmKChhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHx8ICghYXVkaW9Db2RlYyAmJiBhZHRzU2FtcGxlaW5nSW5kZXggPj02KSkgIHtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEFBQykgQU5EIChmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6IE9SIG5iIGNoYW5uZWwgaXMgMSlcbiAgICAgICAgaWYoYXVkaW9Db2RlYyAmJiBhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PS0xICYmIChhZHRzU2FtcGxlaW5nSW5kZXggPj0gNiB8fCBhZHRzQ2hhbmVsQ29uZmlnID09PTEpKSB7XG4gICAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgfVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAvKiByZWZlciB0byBodHRwOi8vd2lraS5tdWx0aW1lZGlhLmN4L2luZGV4LnBocD90aXRsZT1NUEVHLTRfQXVkaW8jQXVkaW9fU3BlY2lmaWNfQ29uZmlnXG4gICAgICBJU08gMTQ0OTYtMyAoQUFDKS5wZGYgLSBUYWJsZSAxLjEzIOKAlCBTeW50YXggb2YgQXVkaW9TcGVjaWZpY0NvbmZpZygpXG4gICAgQXVkaW8gUHJvZmlsZSAvIEF1ZGlvIE9iamVjdCBUeXBlXG4gICAgMDogTnVsbFxuICAgIDE6IEFBQyBNYWluXG4gICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAzOiBBQUMgU1NSIChTY2FsYWJsZSBTYW1wbGUgUmF0ZSlcbiAgICA0OiBBQUMgTFRQIChMb25nIFRlcm0gUHJlZGljdGlvbilcbiAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgNjogQUFDIFNjYWxhYmxlXG4gICBzYW1wbGluZyBmcmVxXG4gICAgMDogOTYwMDAgSHpcbiAgICAxOiA4ODIwMCBIelxuICAgIDI6IDY0MDAwIEh6XG4gICAgMzogNDgwMDAgSHpcbiAgICA0OiA0NDEwMCBIelxuICAgIDU6IDMyMDAwIEh6XG4gICAgNjogMjQwMDAgSHpcbiAgICA3OiAyMjA1MCBIelxuICAgIDg6IDE2MDAwIEh6XG4gICAgOTogMTIwMDAgSHpcbiAgICAxMDogMTEwMjUgSHpcbiAgICAxMTogODAwMCBIelxuICAgIDEyOiA3MzUwIEh6XG4gICAgMTM6IFJlc2VydmVkXG4gICAgMTQ6IFJlc2VydmVkXG4gICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgIENoYW5uZWwgQ29uZmlndXJhdGlvbnNcbiAgICBUaGVzZSBhcmUgdGhlIGNoYW5uZWwgY29uZmlndXJhdGlvbnM6XG4gICAgMDogRGVmaW5lZCBpbiBBT1QgU3BlY2lmYyBDb25maWdcbiAgICAxOiAxIGNoYW5uZWw6IGZyb250LWNlbnRlclxuICAgIDI6IDIgY2hhbm5lbHM6IGZyb250LWxlZnQsIGZyb250LXJpZ2h0XG4gICovXG4gICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICBjb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuICAgIC8vIHNhbXBsaW5nRnJlcXVlbmN5SW5kZXhcbiAgICBjb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgY29uZmlnWzFdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcbiAgICBpZihhZHRzT2JqZWN0VHlwZSA9PT0gNSkge1xuICAgICAgLy8gYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4XG4gICAgICBjb25maWdbMV0gfD0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICBjb25maWdbMl0gPSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAgIC8vIGFkdHNPYmplY3RUeXBlIChmb3JjZSB0byAyLCBjaHJvbWUgaXMgY2hlY2tpbmcgdGhhdCBvYmplY3QgdHlwZSBpcyBsZXNzIHRoYW4gNSA/Pz9cbiAgICAgIC8vICAgIGh0dHBzOi8vY2hyb21pdW0uZ29vZ2xlc291cmNlLmNvbS9jaHJvbWl1bS9zcmMuZ2l0LysvbWFzdGVyL21lZGlhL2Zvcm1hdHMvbXA0L2FhYy5jY1xuICAgICAgY29uZmlnWzJdIHw9IDIgPDwgMjtcbiAgICAgIGNvbmZpZ1szXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiB7IGNvbmZpZyA6IGNvbmZpZywgc2FtcGxlcmF0ZSA6IGFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdLCBjaGFubmVsQ291bnQgOiBhZHRzQ2hhbmVsQ29uZmlnLCBjb2RlYyA6ICgnbXA0YS40MC4nICsgYWR0c09iamVjdFR5cGUpfTtcbiAgfVxuXG4gIF9nZW5lcmF0ZUluaXRTZWdtZW50KCkge1xuICAgIGlmKHRoaXMuX2F2Y0lkID09PSAtMSkge1xuICAgICAgLy9hdWRpbyBvbmx5XG4gICAgICBpZih0aGlzLl9hYWNUcmFjay5jb25maWcpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IHRoaXMuX2FhY1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogdGhpcy5fYWFjVHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9hYWNTYW1wbGVzWzBdLnB0cyAtIDkwMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgfVxuICAgIH0gZWxzZVxuICAgIGlmKHRoaXMuX2FhY0lkID09PSAtMSkge1xuICAgICAgLy92aWRlbyBvbmx5XG4gICAgICBpZih0aGlzLl9hdmNUcmFjay5zcHMgJiYgdGhpcy5fYXZjVHJhY2sucHBzKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQse1xuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICAgIHRoaXMuX2luaXREVFMgPSB0aGlzLl9hdmNTYW1wbGVzWzBdLmR0cyAtIDkwMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2F1ZGlvIGFuZCB2aWRlb1xuICAgICAgaWYodGhpcy5fYWFjVHJhY2suY29uZmlnICYmIHRoaXMuX2F2Y1RyYWNrLnNwcyAmJiB0aGlzLl9hdmNUcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IHRoaXMuX2FhY1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogdGhpcy5fYWFjVHJhY2suY2hhbm5lbENvdW50LFxuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IE1hdGgubWluKHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzLHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzKSAtIDkwMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gTWF0aC5taW4odGhpcy5fYXZjU2FtcGxlc1swXS5kdHMsdGhpcy5fYWFjU2FtcGxlc1swXS5kdHMpIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcbiIsIiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyICAgICAgICAgICAgZnJvbSAnLi4vZGVtdXgvdHNkZW11eGVyJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuXG52YXIgVFNEZW11eGVyV29ya2VyID0gZnVuY3Rpb24gKHNlbGYpIHtcbiAgICBzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLGZ1bmN0aW9uIChldikge1xuICAgICAgLy9jb25zb2xlLmxvZygnZGVtdXhlciBjbWQ6JyArIGV2LmRhdGEuY21kKTtcbiAgICAgIHN3aXRjaChldi5kYXRhLmNtZCkge1xuICAgICAgICBjYXNlICdpbml0JzpcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2R1cmF0aW9uJzpcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIuc2V0RHVyYXRpb24oZXYuZGF0YS5kYXRhKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc3dpdGNoTGV2ZWwnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkZW11eCc6XG4gICAgICAgICAgc2VsZi5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5kYXRhKSwgZXYuZGF0YS5hdWRpb0NvZGVjLGV2LmRhdGEudmlkZW9Db2RlYywgZXYuZGF0YS50aW1lT2Zmc2V0KTtcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIuZW5kKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBsaXN0ZW4gdG8gZXZlbnRzIHRyaWdnZXJlZCBieSBUUyBEZW11eGVyXG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgZnVuY3Rpb24oZXYsZGF0YSkge1xuICAgICAgdmFyIG9iakRhdGEgPSB7IGV2ZW50IDogZXYgfTtcbiAgICAgIHZhciBvYmpUcmFuc2ZlcmFibGUgPSBbXTtcbiAgICAgIGlmKGRhdGEuYXVkaW9Db2RlYykge1xuICAgICAgICBvYmpEYXRhLmF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgICAgIG9iakRhdGEuYXVkaW9Nb292ID0gZGF0YS5hdWRpb01vb3YuYnVmZmVyO1xuICAgICAgICBvYmpEYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID0gZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS5hdWRpb01vb3YpO1xuICAgICAgfVxuICAgICAgaWYoZGF0YS52aWRlb0NvZGVjKSB7XG4gICAgICAgIG9iakRhdGEudmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgb2JqRGF0YS52aWRlb01vb3YgPSBkYXRhLnZpZGVvTW9vdi5idWZmZXI7XG4gICAgICAgIG9iakRhdGEudmlkZW9XaWR0aCA9IGRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgb2JqRGF0YS52aWRlb0hlaWdodCA9IGRhdGEudmlkZW9IZWlnaHQ7XG4gICAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEudmlkZW9Nb292KTtcbiAgICAgIH1cbiAgICAgIC8vIHBhc3MgbW9vdiBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLG9ialRyYW5zZmVyYWJsZSk7XG4gICAgfSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIGZ1bmN0aW9uKGV2LGRhdGEpIHtcbiAgICAgIHZhciBvYmpEYXRhID0geyBldmVudCA6IGV2ICwgdHlwZSA6IGRhdGEudHlwZSwgc3RhcnRQVFMgOiBkYXRhLnN0YXJ0UFRTLCBlbmRQVFMgOiBkYXRhLmVuZFBUUyAsIHN0YXJ0RFRTIDogZGF0YS5zdGFydERUUywgZW5kRFRTIDogZGF0YS5lbmREVFMgLG1vb2YgOiBkYXRhLm1vb2YuYnVmZmVyLCBtZGF0IDogZGF0YS5tZGF0LmJ1ZmZlciwgbmIgOiBkYXRhLm5ifTtcbiAgICAgIC8vIHBhc3MgbW9vZi9tZGF0IGRhdGEgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSxbb2JqRGF0YS5tb29mLG9iakRhdGEubWRhdF0pO1xuICAgIH0pO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCBmdW5jdGlvbihldikge1xuICAgICAgdmFyIG9iakRhdGEgPSB7IGV2ZW50IDogZXYgfTtcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gICAgfSk7XG4gIH07XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcldvcmtlcjtcblxuIiwiZXhwb3J0IGRlZmF1bHQge1xuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIHN1Y2Nlc2Z1bGx5IGF0dGFjaGVkIHRvIHZpZGVvIGVsZW1lbnQgLSBkYXRhOiB7IG1lZGlhU291cmNlIH1cbiAgTVNFX0FUVEFDSEVEIDogJ2hsc01lZGlhU291cmNlQXR0YWNoZWQnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBsb2FkZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgdXJsIDogbWFuaWZlc3RVUkwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9fVxuICBNQU5JRkVTVF9MT0FERUQgIDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gcGFyc2VkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIHN0YXJ0TGV2ZWwgOiBwbGF5YmFjayBzdGFydCBsZXZlbCwgYXVkaW9jb2RlY3N3aXRjaDogdHJ1ZSBpZiBkaWZmZXJlbnQgYXVkaW8gY29kZWNzIHVzZWR9XG4gIE1BTklGRVNUX1BBUlNFRCAgOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGxldmVsSWQgOiBpZCBvZiBsZXZlbCBiZWluZyBsb2FkZWR9XG4gIExFVkVMX0xPQURJTkcgICAgOiAnaGxzTGV2ZWxMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgZmluaXNoZXMgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbElkIDogaWQgb2YgbG9hZGVkIGxldmVsLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfSB9XG4gIExFVkVMX0xPQURFRCA6ICAnaGxzTGV2ZWxMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgc3dpdGNoIGlzIHJlcXVlc3RlZCAtIGRhdGE6IHsgbGV2ZWxJZCA6IGlkIG9mIG5ldyBsZXZlbCB9XG4gIExFVkVMX1NXSVRDSCA6ICAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORyA6ICAnaGxzRnJhZ21lbnRMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBwYXlsb2FkIDogZnJhZ21lbnQgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBGUkFHX0xPQURFRCA6ICAnaGxzRnJhZ21lbnRMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIEluaXQgU2VnbWVudCBoYXMgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vdiA6IG1vb3YgTVA0IGJveCwgY29kZWNzIDogY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnR9XG4gIEZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQgOiAgJ2hsc0ZyYWdtZW50UGFyc2luZ0luaXRTZWdtZW50JyxcbiAgLy8gZmlyZWQgd2hlbiBtb29mL21kYXQgaGF2ZSBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb29mIDogbW9vZiBNUDQgYm94LCBtZGF0IDogbWRhdCBNUDQgYm94fVxuICBGUkFHX1BBUlNJTkdfREFUQSA6ICAnaGxzRnJhZ21lbnRQYXJzaW5nRGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcGFyc2luZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB1bmRlZmluZWRcbiAgRlJBR19QQVJTRUQgOiAgJ2hsc0ZyYWdtZW50UGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCByZW11eGVkIE1QNCBib3hlcyBoYXZlIGFsbCBiZWVuIGFwcGVuZGVkIGludG8gU291cmNlQnVmZmVyIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIHRwYXJzZWQsIHRidWZmZXJlZCwgbGVuZ3RofSB9XG4gIEZSQUdfQlVGRkVSRUQgOiAgJ2hsc0ZyYWdtZW50QnVmZmVyZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IG1hdGNoaW5nIHdpdGggY3VycmVudCB2aWRlbyBwb3NpdGlvbiBpcyBjaGFuZ2luZyAtIGRhdGEgOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QgfVxuICBGUkFHX0NIQU5HRUQgOiAgJ2hsc0ZyYWdtZW50Q2hhbmdlZCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX0VSUk9SIDogICdobHNMZXZlbExvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIExFVkVMX0xPQURfVElNRU9VVCA6ICAnaGxzTGV2ZWxMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGVycm9yIC0gZGF0YTogeyBsZXZlbCA6IGZhdWx0eSBsZXZlbCBJZCwgZXZlbnQgOiBlcnJvciBkZXNjcmlwdGlvbn1cbiAgTEVWRUxfRVJST1IgOiAgJ2hsc0xldmVsRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgRlJBR19MT0FEX0VSUk9SIDogICdobHNGcmFnTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCB0aW1lb3V0IC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgRlJBR19MT0FEX1RJTUVPVVQgOiAgJ2hsc0ZyYWdMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19QQVJTSU5HX0VSUk9SIDogICdobHNGcmFnbWVudFBhcnNpbmdFcnJvcicsXG4gICAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBhcHBlbmRpbmcgZXJyb3IgZXZlbnQgLSBkYXRhOiBhcHBlbmRpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19BUFBFTkRJTkdfRVJST1IgOiAgJ2hsc0ZyYWdtZW50QXBwZW5kaW5nRXJyb3InXG59O1xuIiwiLyoqXG4gKiBITFMgZW5naW5lXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCBTdGF0c0hhbmRsZXIgICAgICAgICBmcm9tICcuL3N0YXRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuL29ic2VydmVyJztcbmltcG9ydCBQbGF5bGlzdExvYWRlciAgICAgICBmcm9tICcuL2xvYWRlci9wbGF5bGlzdC1sb2FkZXInO1xuaW1wb3J0IEJ1ZmZlckNvbnRyb2xsZXIgICAgIGZyb20gJy4vY29udHJvbGxlci9idWZmZXItY29udHJvbGxlcic7XG5pbXBvcnQgTGV2ZWxDb250cm9sbGVyICAgICAgZnJvbSAnLi9jb250cm9sbGVyL2xldmVsLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsZW5hYmxlTG9nc30gIGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBYaHJMb2FkZXIgICAgICAgICAgICBmcm9tICcuL3V0aWxzL3hoci1sb2FkZXInO1xuLy9pbXBvcnQgTVA0SW5zcGVjdCAgICAgICAgIGZyb20gJy9yZW11eC9tcDQtaW5zcGVjdG9yJztcblxuY2xhc3MgSGxzIHtcblxuICBzdGF0aWMgaXNTdXBwb3J0ZWQoKSB7XG4gICAgcmV0dXJuICh3aW5kb3cuTWVkaWFTb3VyY2UgJiYgTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQ7IGNvZGVjcz1cImF2YzEuNDJFMDFFLG1wNGEuNDAuMlwiJykpO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgIHZhciBjb25maWdEZWZhdWx0ID0ge1xuICAgICAgZGVidWcgOiBmYWxzZSxcbiAgICAgIG1heEJ1ZmZlckxlbmd0aCA6IDMwLFxuICAgICAgbWF4QnVmZmVyU2l6ZSA6IDYwKjEwMDAqMTAwMCxcbiAgICAgIGVuYWJsZVdvcmtlciA6IHRydWUsXG4gICAgICBmcmFnTG9hZGluZ1RpbWVPdXQgOiAyMDAwMCxcbiAgICAgIGZyYWdMb2FkaW5nTWF4UmV0cnkgOiAzLFxuICAgICAgZnJhZ0xvYWRpbmdSZXRyeURlbGF5IDogMTAwMCxcbiAgICAgIG1hbmlmZXN0TG9hZGluZ1RpbWVPdXQgOiAxMDAwMCxcbiAgICAgIG1hbmlmZXN0TG9hZGluZ01heFJldHJ5IDogMyxcbiAgICAgIG1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXkgOiAxMDAwLFxuICAgICAgbG9hZGVyIDogWGhyTG9hZGVyXG4gICAgfTtcbiAgICBmb3IgKHZhciBwcm9wIGluIGNvbmZpZ0RlZmF1bHQpIHtcbiAgICAgICAgaWYgKHByb3AgaW4gY29uZmlnKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgIGNvbmZpZ1twcm9wXSA9IGNvbmZpZ0RlZmF1bHRbcHJvcF07XG4gICAgfVxuICAgIGVuYWJsZUxvZ3MoY29uZmlnLmRlYnVnKTtcblxuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBuZXcgUGxheWxpc3RMb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IG5ldyBMZXZlbENvbnRyb2xsZXIodGhpcy5wbGF5bGlzdExvYWRlcik7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyID0gbmV3IEJ1ZmZlckNvbnRyb2xsZXIodGhpcy5sZXZlbENvbnRyb2xsZXIsY29uZmlnKTtcbiAgICB0aGlzLnN0YXRzSGFuZGxlciA9IG5ldyBTdGF0c0hhbmRsZXIoY29uZmlnKTtcbiAgICB0aGlzLkV2ZW50cyA9IEV2ZW50O1xuICAgIC8vIG9ic2VydmVyIHNldHVwXG4gICAgdGhpcy5vbiA9IG9ic2VydmVyLm9uLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMub2ZmID0gb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIuYmluZChvYnNlcnZlcik7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmKHRoaXMucGxheWxpc3RMb2FkZXIpIHtcbiAgICAgIHRoaXMucGxheWxpc3RMb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMuYnVmZmVyQ29udHJvbGxlcikge1xuICAgICAgdGhpcy5idWZmZXJDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMubGV2ZWxDb250cm9sbGVyKSB7XG4gICAgICB0aGlzLmxldmVsQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudW5sb2FkU291cmNlKCk7XG4gICAgdGhpcy5kZXRhY2hWaWRlbygpO1xuICAgIG9ic2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICB9XG5cbiAgYXR0YWNoVmlkZW8odmlkZW8pIHtcbiAgICB0aGlzLnZpZGVvID0gdmlkZW87XG4gICAgdGhpcy5zdGF0c0hhbmRsZXIuYXR0YWNoVmlkZW8odmlkZW8pO1xuICAgIC8vIHNldHVwIHRoZSBtZWRpYSBzb3VyY2VcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlID0gbmV3IE1lZGlhU291cmNlKCk7XG4gICAgLy9NZWRpYSBTb3VyY2UgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25NZWRpYVNvdXJjZU9wZW4uYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1lZGlhU291cmNlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNjID0gdGhpcy5vbk1lZGlhU291cmNlQ2xvc2UuYmluZCh0aGlzKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgIHRoaXMub25tc28pO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAvLyBsaW5rIHZpZGVvIGFuZCBtZWRpYSBTb3VyY2VcbiAgICB2aWRlby5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG1zKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsdGhpcy5vbnZlcnJvcik7XG4gIH1cblxuICBkZXRhY2hWaWRlbygpIHtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyLmRldGFjaFZpZGVvKHZpZGVvKTtcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmKG1zKSB7XG4gICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB2aWRlby5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIGlmKHZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBsb2FkU291cmNlKHVybCkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIGxvZ2dlci5sb2coYGxvYWRTb3VyY2U6JHt1cmx9YCk7XG4gICAgLy8gd2hlbiBhdHRhY2hpbmcgdG8gYSBzb3VyY2UgVVJMLCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZFxuICAgIHRoaXMucGxheWxpc3RMb2FkZXIubG9hZCh1cmwsbnVsbCk7XG4gIH1cblxuICByZWNvdmVyRXJyb3IoKSB7XG4gICAgbG9nZ2VyLmxvZygndHJ5IHRvIHJlY292ZXIgZXJyb3InKTtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHRoaXMuZGV0YWNoVmlkZW8oKTtcbiAgICB0aGlzLmF0dGFjaFZpZGVvKHZpZGVvKTtcbiAgfVxuXG4gIHVubG9hZFNvdXJjZSgpIHtcbiAgICB0aGlzLnVybCA9IG51bGw7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgbmV4dCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBuZXh0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsICA9PT0gLTEpO1xuICB9XG5cbiAgLyogcmV0dXJuIG1hbnVhbCBsZXZlbCAqL1xuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsO1xuICB9XG5cblxuICAvKiByZXR1cm4gcGxheWJhY2sgc2Vzc2lvbiBzdGF0cyAqL1xuICBnZXQgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHNIYW5kbGVyLnN0YXRzO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NU0VfQVRUQUNIRUQsIHsgdmlkZW86IHRoaXMudmlkZW8sIG1lZGlhU291cmNlIDogdGhpcy5tZWRpYVNvdXJjZSB9KTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiIC8qXG4gKiBmcmFnbWVudCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuXG4gY2xhc3MgRnJhZ21lbnRMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnPWNvbmZpZztcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICBpZih0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKGZyYWcpIHtcbiAgICB0aGlzLmZyYWcgPSBmcmFnO1xuICAgIHRoaXMubG9hZGVyID0gbmV3IHRoaXMuY29uZmlnLmxvYWRlcigpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQoZnJhZy51cmwsJ2FycmF5YnVmZmVyJyx0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdUaW1lT3V0LCB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSk7XG4gIH1cblxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciBwYXlsb2FkID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZTtcbiAgICBzdGF0cy5sZW5ndGggPSBwYXlsb2FkLmJ5dGVMZW5ndGg7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgeyBwYXlsb2FkIDogcGF5bG9hZCxcbiAgICAgICAgICAgICAgICAgICAgICBmcmFnIDogdGhpcy5mcmFnICxcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9FUlJPUiwgeyB1cmwgOiB0aGlzLmZyYWcudXJsLCBldmVudDpldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9USU1FT1VULCB7IHVybCA6IHRoaXMuZnJhZy51cmx9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBGcmFnbWVudExvYWRlcjtcbiIsIi8qXG4gKiBwbGF5bGlzdCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuLy9pbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFBsYXlsaXN0TG9hZGVyIHtcblxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLm1hbmlmZXN0TG9hZGVkID0gZmFsc2U7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICBpZih0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKHVybCxyZXF1ZXN0SWQpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLmlkID0gcmVxdWVzdElkO1xuICAgIHRoaXMubG9hZGVyID0gbmV3IHRoaXMuY29uZmlnLmxvYWRlcigpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQodXJsLCcnLHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKSwgdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKSwgdGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aGlzLmNvbmZpZy5tYW5pZmVzdExvYWRpbmdUaW1lT3V0LCB0aGlzLmNvbmZpZy5tYW5pZmVzdExvYWRpbmdNYXhSZXRyeSx0aGlzLmNvbmZpZy5tYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5KTtcbiAgfVxuXG4gIHJlc29sdmUodXJsLCBiYXNlVXJsKSB7XG4gICAgdmFyIGRvYyAgICAgID0gZG9jdW1lbnQsXG4gICAgICAgIG9sZEJhc2UgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2Jhc2UnKVswXSxcbiAgICAgICAgb2xkSHJlZiA9IG9sZEJhc2UgJiYgb2xkQmFzZS5ocmVmLFxuICAgICAgICBkb2NIZWFkID0gZG9jLmhlYWQgfHwgZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF0sXG4gICAgICAgIG91ckJhc2UgPSBvbGRCYXNlIHx8IGRvY0hlYWQuYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ2Jhc2UnKSksXG4gICAgICAgIHJlc29sdmVyID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2EnKSxcbiAgICAgICAgcmVzb2x2ZWRVcmw7XG5cbiAgICBvdXJCYXNlLmhyZWYgPSBiYXNlVXJsO1xuICAgIHJlc29sdmVyLmhyZWYgPSB1cmw7XG4gICAgcmVzb2x2ZWRVcmwgID0gcmVzb2x2ZXIuaHJlZjsgLy8gYnJvd3NlciBtYWdpYyBhdCB3b3JrIGhlcmVcblxuICAgIGlmIChvbGRCYXNlKSB7b2xkQmFzZS5ocmVmID0gb2xkSHJlZjt9XG4gICAgZWxzZSB7ZG9jSGVhZC5yZW1vdmVDaGlsZChvdXJCYXNlKTt9XG4gICAgcmV0dXJuIHJlc29sdmVkVXJsO1xuICB9XG5cbiAgcGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsYmFzZXVybCkge1xuICAgIHZhciBsZXZlbHMgPSBbXSxsZXZlbCA9ICB7fSxyZXN1bHQsY29kZWNzLGNvZGVjO1xuICAgIHZhciByZSA9IC8jRVhULVgtU1RSRUFNLUlORjooW15cXG5cXHJdKihCQU5EKVdJRFRIPShcXGQrKSk/KFteXFxuXFxyXSooQ09ERUNTKT1cXFwiKC4qKVxcXCIsKT8oW15cXG5cXHJdKihSRVMpT0xVVElPTj0oXFxkKyl4KFxcZCspKT8oW15cXG5cXHJdKihOQU1FKT1cXFwiKC4qKVxcXCIpP1teXFxuXFxyXSpbXFxyXFxuXSsoW15cXHJcXG5dKykvZztcbiAgICB3aGlsZSgocmVzdWx0ID0gcmUuZXhlYyhzdHJpbmcpKSAhPSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKXsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpO30pO1xuICAgICAgbGV2ZWwudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdC5wb3AoKSxiYXNldXJsKTtcbiAgICAgIHdoaWxlKHJlc3VsdC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHN3aXRjaChyZXN1bHQuc2hpZnQoKSkge1xuICAgICAgICAgIGNhc2UgJ1JFUyc6XG4gICAgICAgICAgICBsZXZlbC53aWR0aCA9IHBhcnNlSW50KHJlc3VsdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIGxldmVsLmhlaWdodCA9IHBhcnNlSW50KHJlc3VsdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0JBTkQnOlxuICAgICAgICAgICAgbGV2ZWwuYml0cmF0ZSA9IHBhcnNlSW50KHJlc3VsdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ05BTUUnOlxuICAgICAgICAgICAgbGV2ZWwubmFtZSA9IHJlc3VsdC5zaGlmdCgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnQ09ERUNTJzpcbiAgICAgICAgICAgIGNvZGVjcyA9IHJlc3VsdC5zaGlmdCgpLnNwbGl0KCcsJyk7XG4gICAgICAgICAgICB3aGlsZShjb2RlY3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBjb2RlYyA9IGNvZGVjcy5zaGlmdCgpO1xuICAgICAgICAgICAgICBpZihjb2RlYy5pbmRleE9mKCdhdmMxJykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwudmlkZW9Db2RlYyA9IHRoaXMuYXZjMXRvYXZjb3RpKGNvZGVjKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXZlbC5hdWRpb0NvZGVjID0gY29kZWM7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgbGV2ZWwgPSB7fTtcbiAgICB9XG4gICAgcmV0dXJuIGxldmVscztcbiAgfVxuXG4gIGF2YzF0b2F2Y290aShjb2RlYykge1xuICAgIHZhciByZXN1bHQsYXZjZGF0YSA9IGNvZGVjLnNwbGl0KCcuJyk7XG4gICAgaWYoYXZjZGF0YS5sZW5ndGggPiAyKSB7XG4gICAgICByZXN1bHQgPSBhdmNkYXRhLnNoaWZ0KCkgKyAnLic7XG4gICAgICByZXN1bHQgKz0gcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNik7XG4gICAgICByZXN1bHQgKz0gKCcwMCcgKyBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC00KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gY29kZWM7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsLCBpZCkge1xuICAgIHZhciBjdXJyZW50U04gPSAwLHRvdGFsZHVyYXRpb24gPSAwLCBsZXZlbCA9IHsgdXJsIDogYmFzZXVybCwgZnJhZ21lbnRzIDogW10sIGxpdmUgOiB0cnVlfSwgcmVzdWx0LCByZWdleHA7XG4gICAgcmVnZXhwID0gLyg/OiNFWFQtWC0oTUVESUEtU0VRVUVOQ0UpOihcXGQrKSl8KD86I0VYVC1YLShUQVJHRVREVVJBVElPTik6KFxcZCspKXwoPzojRVhUKElORik6KFtcXGRcXC5dKylbXlxcclxcbl0qW1xcclxcbl0rKFteXFxyXFxuXSspfCg/OiNFWFQtWC0oRU5ETElTVCkpKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZWdleHAuZXhlYyhzdHJpbmcpKSAhPT0gbnVsbCl7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obil7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTt9KTtcbiAgICAgIHN3aXRjaChyZXN1bHRbMF0pIHtcbiAgICAgICAgY2FzZSAnTUVESUEtU0VRVUVOQ0UnOlxuICAgICAgICAgIGN1cnJlbnRTTiA9IGxldmVsLnN0YXJ0U04gPSBwYXJzZUludChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdUQVJHRVREVVJBVElPTic6XG4gICAgICAgICAgbGV2ZWwudGFyZ2V0ZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0VORExJU1QnOlxuICAgICAgICAgIGxldmVsLmxpdmUgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnSU5GJzpcbiAgICAgICAgICB2YXIgZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgbGV2ZWwuZnJhZ21lbnRzLnB1c2goe3VybCA6IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sYmFzZXVybCksIGR1cmF0aW9uIDogZHVyYXRpb24sIHN0YXJ0IDogdG90YWxkdXJhdGlvbiwgc24gOiBjdXJyZW50U04rKywgbGV2ZWw6aWR9KTtcbiAgICAgICAgICB0b3RhbGR1cmF0aW9uKz1kdXJhdGlvbjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmb3VuZCAnICsgbGV2ZWwuZnJhZ21lbnRzLmxlbmd0aCArICcgZnJhZ21lbnRzJyk7XG4gICAgbGV2ZWwudG90YWxkdXJhdGlvbiA9IHRvdGFsZHVyYXRpb247XG4gICAgbGV2ZWwuZW5kU04gPSBjdXJyZW50U04gLSAxO1xuICAgIHJldHVybiBsZXZlbDtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciBzdHJpbmcgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlVGV4dCwgdXJsID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVVSTCwgaWQgPSB0aGlzLmlkLGxldmVscztcbiAgICAvLyByZXNwb25zZVVSTCBub3Qgc3VwcG9ydGVkIG9uIHNvbWUgYnJvd3NlcnMgKGl0IGlzIHVzZWQgdG8gZGV0ZWN0IFVSTCByZWRpcmVjdGlvbilcbiAgICBpZih1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFsbGJhY2sgdG8gaW5pdGlhbCBVUkxcbiAgICAgIHVybCA9IHRoaXMudXJsO1xuICAgIH1cbiAgICBzdGF0cy50bG9hZCA9IG5ldyBEYXRlKCk7XG4gICAgc3RhdHMubXRpbWUgPSBuZXcgRGF0ZShldmVudC5jdXJyZW50VGFyZ2V0LmdldFJlc3BvbnNlSGVhZGVyKCdMYXN0LU1vZGlmaWVkJykpO1xuXG4gICAgaWYoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCBsZXZlbCB3aWxsIGJlIHJlbG9hZGVkIGFmdGVyd2FyZHNcbiAgICAgICAgLy8gKHRoaXMgaXMgdG8gaGF2ZSBhIHVuaWZvcm0gbG9naWMgZm9yIDEgbGV2ZWwvbXVsdGlsZXZlbCBwbGF5bGlzdHMpXG4gICAgICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiBbe3VybCA6IHVybH1dLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgZGV0YWlscyA6IHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZyx1cmwsaWQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsSWQgOiBpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVscyA9IHRoaXMucGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsdXJsKTtcbiAgICAgICAgLy8gbXVsdGkgbGV2ZWwgcGxheWxpc3QsIHBhcnNlIGxldmVsIGluZm9cbiAgICAgICAgaWYobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxldmVscyA6IGxldmVscyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiB1cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQgOiBpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX0VSUk9SLCB7IHVybCA6IHVybCwgcmVzcG9uc2UgOiAnbm8gbGV2ZWwgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX0VSUk9SLCB7IHVybCA6IHVybCwgcmVzcG9uc2UgOiBldmVudC5jdXJyZW50VGFyZ2V0fSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FEX0VSUk9SLCB7IHVybCA6IHRoaXMudXJsLCByZXNwb25zZSA6IGV2ZW50LmN1cnJlbnRUYXJnZXR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FEX1RJTUVPVVQsIHsgdXJsIDogdGhpcy51cmx9KTtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFBsYXlsaXN0TG9hZGVyO1xuIiwiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuXG5sZXQgb2JzZXJ2ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5cbm9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBvYnNlcnZlcjtcbiIsIi8qKlxuICogZ2VuZXJhdGUgTVA0IEJveFxuICovXG5cbmNsYXNzIE1QNCB7XG4gIHN0YXRpYyBpbml0KCkge1xuICAgIE1QNC50eXBlcyA9IHtcbiAgICAgIGF2YzE6IFtdLCAvLyBjb2RpbmduYW1lXG4gICAgICBhdmNDOiBbXSxcbiAgICAgIGJ0cnQ6IFtdLFxuICAgICAgZGluZjogW10sXG4gICAgICBkcmVmOiBbXSxcbiAgICAgIGVzZHM6IFtdLFxuICAgICAgZnR5cDogW10sXG4gICAgICBoZGxyOiBbXSxcbiAgICAgIG1kYXQ6IFtdLFxuICAgICAgbWRoZDogW10sXG4gICAgICBtZGlhOiBbXSxcbiAgICAgIG1maGQ6IFtdLFxuICAgICAgbWluZjogW10sXG4gICAgICBtb29mOiBbXSxcbiAgICAgIG1vb3Y6IFtdLFxuICAgICAgbXA0YTogW10sXG4gICAgICBtdmV4OiBbXSxcbiAgICAgIG12aGQ6IFtdLFxuICAgICAgc2R0cDogW10sXG4gICAgICBzdGJsOiBbXSxcbiAgICAgIHN0Y286IFtdLFxuICAgICAgc3RzYzogW10sXG4gICAgICBzdHNkOiBbXSxcbiAgICAgIHN0c3o6IFtdLFxuICAgICAgc3R0czogW10sXG4gICAgICB0ZmR0OiBbXSxcbiAgICAgIHRmaGQ6IFtdLFxuICAgICAgdHJhZjogW10sXG4gICAgICB0cmFrOiBbXSxcbiAgICAgIHRydW46IFtdLFxuICAgICAgdHJleDogW10sXG4gICAgICB0a2hkOiBbXSxcbiAgICAgIHZtaGQ6IFtdLFxuICAgICAgc21oZDogW11cbiAgICB9O1xuXG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIE1QNC50eXBlcykge1xuICAgICAgaWYgKE1QNC50eXBlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBNUDQudHlwZXNbaV0gPSBbXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDApLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgxKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMiksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDMpXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgTVA0Lk1BSk9SX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2knLmNoYXJDb2RlQXQoMCksXG4gICAgICAncycuY2hhckNvZGVBdCgwKSxcbiAgICAgICdvJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ20nLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuQVZDMV9CUkFORCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICdhJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ3YnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnYycuY2hhckNvZGVBdCgwKSxcbiAgICAgICcxJy5jaGFyQ29kZUF0KDApXG4gICAgXSk7XG4gICAgTVA0Lk1JTk9SX1ZFUlNJT04gPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMV0pO1xuICAgIE1QNC5WSURFT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuQVVESU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOk1QNC5WSURFT19IRExSLFxuICAgICAgJ2F1ZGlvJzpNUDQuQVVESU9fSERMUlxuICAgIH07XG4gICAgTVA0LkRSRUYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG4gICAgTVA0LlNUQ08gPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCAvLyBlbnRyeV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5TVFNDID0gTVA0LlNUQ087XG4gICAgTVA0LlNUVFMgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIE1QNC5NQUpPUl9CUkFORCwgTVA0Lk1JTk9SX1ZFUlNJT04sIE1QNC5NQUpPUl9CUkFORCwgTVA0LkFWQzFfQlJBTkQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgTVA0LkRSRUYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gMCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgcmVzdWx0LFxuICAgIHZpZXc7XG5cbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShzaXplICsgOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhyZXN1bHQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLCByZXN1bHQuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcblxuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBwYXlsb2FkLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZChkdXJhdGlvbikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAzLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMSwgMHg1ZiwgMHg5MCwgLy8gdGltZXNjYWxlLCA5MCwwMDAgXCJ0aWNrc1wiIHBlciBzZWNvbmRcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMjQpLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gIDgpICYgMHhGRixcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnNtaGQsIE1QNC5TTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy52bWhkLCBNUDQuVk1IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBtb29mKHNuLCBiYXNlTWVkaWFEZWNvZGVUaW1lLCB0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tb29mLFxuICAgICAgICAgICAgICAgICAgIE1QNC5tZmhkKHNuKSxcbiAgICAgICAgICAgICAgICAgICBNUDQudHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSk7XG4gIH1cbi8qKlxuICogQHBhcmFtIHRyYWNrcy4uLiAob3B0aW9uYWwpIHthcnJheX0gdGhlIHRyYWNrcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBtb3ZpZVxuICovXG4gIHN0YXRpYyBtb292KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJhayh0cmFja3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubW9vdiwgTVA0Lm12aGQodHJhY2tzWzBdLmR1cmF0aW9uKV0uY29uY2F0KGJveGVzKS5jb25jYXQoTVA0Lm12ZXgodHJhY2tzKSkpO1xuICB9XG5cbiAgc3RhdGljIG12ZXgodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmV4KHRyYWNrc1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubXZleF0uY29uY2F0KGJveGVzKSk7XG4gIH1cblxuICBzdGF0aWMgbXZoZChkdXJhdGlvbikge1xuICAgIHZhclxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4NWYsIDB4OTAsIC8vIHRpbWVzY2FsZSwgOTAsMDAwIFwidGlja3NcIiBwZXIgc2Vjb25kXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLCAvLyAxLjAgcmF0ZVxuICAgICAgICAweDAxLCAweDAwLCAvLyAxLjAgdm9sdW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHhmZiwgMHhmZiwgMHhmZiwgMHhmZiAvLyBuZXh0X3RyYWNrX0lEXG4gICAgICBdKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXZoZCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHNkdHAodHJhY2spIHtcbiAgICB2YXJcbiAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheSg0ICsgc2FtcGxlcy5sZW5ndGgpLFxuICAgICAgZmxhZ3MsXG4gICAgICBpO1xuXG4gICAgLy8gbGVhdmUgdGhlIGZ1bGwgYm94IGhlYWRlciAoNCBieXRlcykgYWxsIHplcm9cblxuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzW2ldLmZsYWdzO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKGZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsXG4gICAgICAgICAgICAgICBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc3RibCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdGJsLFxuICAgICAgICAgICAgICAgTVA0LnN0c2QodHJhY2spLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RzYywgTVA0LlNUU0MpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RzeiwgTVA0LlNUU1opLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaTtcbiAgICAvLyBhc3NlbWJsZSB0aGUgU1BTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5zcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNwcy5wdXNoKCh0cmFjay5zcHNbaV0uYnl0ZUxlbmd0aCA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHNwcy5wdXNoKCh0cmFjay5zcHNbaV0uYnl0ZUxlbmd0aCAmIDB4RkYpKTsgLy8gc2VxdWVuY2VQYXJhbWV0ZXJTZXRMZW5ndGhcbiAgICAgIHNwcyA9IHNwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodHJhY2suc3BzW2ldKSk7IC8vIFNQU1xuICAgIH1cblxuICAgIC8vIGFzc2VtYmxlIHRoZSBQUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnBwcy5sZW5ndGg7IGkrKykge1xuICAgICAgcHBzLnB1c2goKHRyYWNrLnBwc1tpXS5ieXRlTGVuZ3RoID4+PiA4KSAmIDB4RkYpO1xuICAgICAgcHBzLnB1c2goKHRyYWNrLnBwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpO1xuICAgICAgcHBzID0gcHBzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5wcHNbaV0pKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuYXZjMSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAodHJhY2sud2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgICB0cmFjay53aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAgICh0cmFjay5oZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgICB0cmFjay5oZWlnaHQgJiAweGZmLCAvLyBoZWlnaHRcbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gaG9yaXpyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGZyYW1lX2NvdW50XG4gICAgICAgIDB4MTMsXG4gICAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAgIDB4NmYsIDB4NmEsIDB4NzMsIDB4MmQsXG4gICAgICAgIDB4NjMsIDB4NmYsIDB4NmUsIDB4NzQsXG4gICAgICAgIDB4NzIsIDB4NjksIDB4NjIsIDB4MmQsXG4gICAgICAgIDB4NjgsIDB4NmMsIDB4NzMsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNvbXByZXNzb3JuYW1lXG4gICAgICAgIDB4MDAsIDB4MTgsIC8vIGRlcHRoID0gMjRcbiAgICAgICAgMHgxMSwgMHgxMV0pLCAvLyBwcmVfZGVmaW5lZCA9IC0xXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYXZjQywgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMSwgLy8gY29uZmlndXJhdGlvblZlcnNpb25cbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVJZGMsIC8vIEFWQ1Byb2ZpbGVJbmRpY2F0aW9uXG4gICAgICAgICAgICB0cmFjay5wcm9maWxlQ29tcGF0aWJpbGl0eSwgLy8gcHJvZmlsZV9jb21wYXRpYmlsaXR5XG4gICAgICAgICAgICB0cmFjay5sZXZlbElkYywgLy8gQVZDTGV2ZWxJbmRpY2F0aW9uXG4gICAgICAgICAgICAweGZmIC8vIGxlbmd0aFNpemVNaW51c09uZSwgaGFyZC1jb2RlZCB0byA0IGJ5dGVzXG4gICAgICAgICAgXS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2suc3BzLmxlbmd0aCAvLyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChzcHMpLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5wcHMubGVuZ3RoIC8vIG51bU9mUGljdHVyZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQocHBzKSkpLCAvLyBcIlBQU1wiXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrdHJhY2suY29uZmlnLmxlbmd0aCwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK3RyYWNrLmNvbmZpZy5sZW5ndGgsIC8vIGxlbmd0aFxuICAgICAgMHg0MCwgLy9jb2RlYyA6IG1wZWc0X2F1ZGlvXG4gICAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYnVmZmVyX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1heEJpdHJhdGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgICAgMHgwNSAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIF0uY29uY2F0KFt0cmFjay5jb25maWcubGVuZ3RoXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgICAgKHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQubXA0YSh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQuYXZjMSh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB0a2hkKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRraGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwNywgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodHJhY2suaWQgPj4gMjQpICYgMHhGRixcbiAgICAgICh0cmFjay5pZCA+PiAxNikgJiAweEZGLFxuICAgICAgKHRyYWNrLmlkID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmlkICYgMHhGRiwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbGF5ZXJcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGFsdGVybmF0ZV9ncm91cFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbm9uLWF1ZGlvIHRyYWNrIHZvbHVtZVxuICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgKHRyYWNrLndpZHRoID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLndpZHRoICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHdpZHRoXG4gICAgICAodHJhY2suaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmhlaWdodCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwIC8vIGhlaWdodFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpIHtcbiAgICB2YXIgc2FtcGxlRGVwZW5kZW5jeVRhYmxlID0gTVA0LnNkdHAodHJhY2spO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFmLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDI0KSxcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYpIC8vIHRyYWNrX0lEXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmR0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PjI0KSxcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYpIC8vIGJhc2VNZWRpYURlY29kZVRpbWVcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC50cnVuKHRyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmhkXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZkdFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIHRyYWYgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gbWZoZFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIG1vb2YgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDgpLCAgLy8gbWRhdCBoZWFkZXJcbiAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZSk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSB0cmFjayBib3guXG4gICAqIEBwYXJhbSB0cmFjayB7b2JqZWN0fSBhIHRyYWNrIGRlZmluaXRpb25cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIHRyYWNrIGJveFxuICAgKi9cbiAgc3RhdGljIHRyYWsodHJhY2spIHtcbiAgICB0cmFjay5kdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uIHx8IDB4ZmZmZmZmZmY7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWssXG4gICAgICAgICAgICAgICBNUDQudGtoZCh0cmFjayksXG4gICAgICAgICAgICAgICBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAodHJhY2suaWQgPj4gMjQpLFxuICAgICAodHJhY2suaWQgPj4gMTYpICYgMFhGRixcbiAgICAgKHRyYWNrLmlkID4+IDgpICYgMFhGRixcbiAgICAgKHRyYWNrLmlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIHNhbXBsZXMsIHNhbXBsZSwgaSwgYXJyYXk7XG5cbiAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXTtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KDEyICsgKDE2ICogc2FtcGxlcy5sZW5ndGgpKTtcbiAgICBvZmZzZXQgKz0gOCArIGFycmF5LmJ5dGVMZW5ndGg7XG5cbiAgICBhcnJheS5zZXQoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDBmLCAweDAxLCAvLyBmbGFnc1xuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiAyNCkgJiAweEZGLFxuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiAxNikgJiAweEZGLFxuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiA4KSAmIDB4RkYsXG4gICAgICBzYW1wbGVzLmxlbmd0aCAmIDB4RkYsIC8vIHNhbXBsZV9jb3VudFxuICAgICAgKG9mZnNldCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiA4KSAmIDB4RkYsXG4gICAgICBvZmZzZXQgJiAweEZGIC8vIGRhdGFfb2Zmc2V0XG4gICAgXSwwKTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzYW1wbGUgPSBzYW1wbGVzW2ldO1xuICAgICAgYXJyYXkuc2V0KFtcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuZHVyYXRpb24gJiAweEZGLCAvLyBzYW1wbGVfZHVyYXRpb25cbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuc2l6ZSAmIDB4RkYsIC8vIHNhbXBsZV9zaXplXG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgc2FtcGxlLmZsYWdzLmRlcGVuZHNPbixcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAgIChzYW1wbGUuZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKHNhbXBsZS5mbGFncy5wYWRkaW5nVmFsdWUgPDwgMSkgfFxuICAgICAgICAgIHNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUsXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRhdGlvblByaW9yaXR5ICYgMHhGMCA8PCA4LFxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkYXRpb25Qcmlvcml0eSAmIDB4MEYsIC8vIHNhbXBsZV9mbGFnc1xuICAgICAgICAoc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgICAgXSwxMisxNippKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRydW4sIGFycmF5KTtcbiAgfVxuXG4gIHN0YXRpYyBpbml0U2VnbWVudCh0cmFja3MpIHtcblxuICAgIGlmKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhclxuICAgICAgbW92aWUgPSBNUDQubW9vdih0cmFja3MpLFxuICAgICAgcmVzdWx0O1xuXG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoTVA0LkZUWVAuYnl0ZUxlbmd0aCArIG1vdmllLmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQoTVA0LkZUWVApO1xuICAgIHJlc3VsdC5zZXQobW92aWUsIE1QNC5GVFlQLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuXG5cbiIsIiAvKlxuICogU3RhdHMgSGFuZGxlclxuICpcbiAqL1xuXG4vLyBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi9ldmVudHMnO1xuLy8gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4vb2JzZXJ2ZXInO1xuXG4gY2xhc3MgU3RhdHNIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcbiAgICB0aGlzLmNvbmZpZz1jb25maWc7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgYXR0YWNoVmlkZW8odmlkZW8pIHtcbiAgICB0aGlzLnZpZGVvID0gdmlkZW87XG5cbiAgfVxuXG4gIGRldGFjaFZpZGVvKCkge1xuICAgIHRoaXMudmlkZW8gPSBudWxsO1xuICB9XG5cbiAgZ2V0IHN0YXRzKCkge1xuICAgIHJldHVybiB7dGVjaCA6ICdobHMuanMnfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTdGF0c0hhbmRsZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vb3AoKXt9XG5sZXQgZmFrZUxvZ2dlciA9IHtcbiAgbG9nOiBub29wLFxuICB3YXJuOiBub29wLFxuICBpbmZvOiBub29wLFxuICBlcnJvcjogbm9vcFxufTtcbmxldCBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG5cbmV4cG9ydCB2YXIgZW5hYmxlTG9ncyA9IGZ1bmN0aW9uKGRlYnVnKSB7XG4gIGlmIChkZWJ1ZyA9PT0gdHJ1ZSB8fCB0eXBlb2YgZGVidWcgICAgICAgPT09ICdvYmplY3QnKSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIubG9nICAgPSBkZWJ1Zy5sb2cgICA/IGRlYnVnLmxvZy5iaW5kKGRlYnVnKSAgIDogY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci5pbmZvICA9IGRlYnVnLmluZm8gID8gZGVidWcuaW5mby5iaW5kKGRlYnVnKSAgOiBjb25zb2xlLmluZm8uYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci5lcnJvciA9IGRlYnVnLmVycm9yID8gZGVidWcuZXJyb3IuYmluZChkZWJ1ZykgOiBjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIud2FybiAgPSBkZWJ1Zy53YXJuICA/IGRlYnVnLndhcm4uYmluZChkZWJ1ZykgIDogY29uc29sZS53YXJuLmJpbmQoY29uc29sZSk7XG5cbiAgICAvLyBTb21lIGJyb3dzZXJzIGRvbid0IGFsbG93IHRvIHVzZSBiaW5kIG9uIGNvbnNvbGUgb2JqZWN0IGFueXdheVxuICAgIC8vIGZhbGxiYWNrIHRvIGRlZmF1bHQgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgZXhwb3J0ZWRMb2dnZXIubG9nKCk7XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICBleHBvcnRlZExvZ2dlci5sb2cgICA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci5pbmZvICA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci5lcnJvciA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci53YXJuICA9IG5vb3A7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgfVxufTtcbmV4cG9ydCB2YXIgbG9nZ2VyID0gZXhwb3J0ZWRMb2dnZXI7XG4iLCIgLypcbiAgKiBYaHIgYmFzZWQgTG9hZGVyXG4gICpcbiAgKi9cblxuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbiBjbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmFib3J0KCk7XG4gICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICB9XG5cbiAgYWJvcnQoKSB7XG4gICAgaWYodGhpcy5sb2FkZXIgJiZ0aGlzLmxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICBpZih0aGlzLnRpbWVvdXRIYW5kbGUpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKHVybCxyZXNwb25zZVR5cGUsb25TdWNjZXNzLG9uRXJyb3Isb25UaW1lb3V0LHRpbWVvdXQsbWF4UmV0cnkscmV0cnlEZWxheSkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuICAgIHRoaXMub25TdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy50cmVxdWVzdCA9IG5ldyBEYXRlKCk7XG4gICAgdGhpcy50aW1lb3V0ID0gdGltZW91dDtcbiAgICB0aGlzLm1heFJldHJ5ID0gbWF4UmV0cnk7XG4gICAgdGhpcy5yZXRyeURlbGF5ID0gcmV0cnlEZWxheTtcbiAgICB0aGlzLnJldHJ5ID0gMDtcbiAgICB0aGlzLnRpbWVvdXRIYW5kbGUgPSB3aW5kb3cuc2V0VGltZW91dCh0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksdGltZW91dCk7XG4gICAgdGhpcy5sb2FkSW50ZXJuYWwoKTtcbiAgfVxuXG4gIGxvYWRJbnRlcm5hbCgpIHtcbiAgICB2YXIgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkID0gIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub25lcnJvciA9IHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vcGVuKCdHRVQnLCB0aGlzLnVybCAsIHRydWUpO1xuICAgIHhoci5yZXNwb25zZVR5cGUgPSB0aGlzLnJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLnRmaXJzdCA9IG51bGw7XG4gICAgdGhpcy5sb2FkZWQgPSAwO1xuICAgIHhoci5zZW5kKCk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICB0aGlzLm9uU3VjY2VzcyhldmVudCx7dHJlcXVlc3QgOiB0aGlzLnRyZXF1ZXN0LCB0Zmlyc3QgOiB0aGlzLnRmaXJzdCwgdGxvYWQgOiBuZXcgRGF0ZSgpLCBsb2FkZWQgOiB0aGlzLmxvYWRlZH0pO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgaWYodGhpcy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgIGxvZ2dlci5sb2coYCR7ZXZlbnQudHlwZX0gd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfSwgcmV0cnlpbmcgaW4gJHt0aGlzLnJldHJ5RGVsYXl9Li4uYCk7XG4gICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksdGhpcy5yZXRyeURlbGF5KTtcbiAgICAgIC8vIGV4cG9uZW50aWFsIGJhY2tvZmZcbiAgICAgIHRoaXMucmV0cnlEZWxheT1NYXRoLm1pbigyKnRoaXMucmV0cnlEZWxheSw2NDAwMCk7XG4gICAgICB0aGlzLnJldHJ5Kys7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgIGxvZ2dlci5sb2coYCR7ZXZlbnQudHlwZX0gd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfWAgKTtcbiAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgfVxuICB9XG5cbiAgbG9hZHRpbWVvdXQoZXZlbnQpIHtcbiAgICBsb2dnZXIubG9nKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQse3RyZXF1ZXN0IDogdGhpcy50cmVxdWVzdCwgdGZpcnN0IDogdGhpcy50Zmlyc3QsIGxvYWRlZCA6IHRoaXMubG9hZGVkfSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQpIHtcbiAgICBpZih0aGlzLnRmaXJzdCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy50Zmlyc3QgPSBuZXcgRGF0ZSgpO1xuICAgIH1cbiAgICBpZihldmVudC5sZW5ndGhDb21wdXRhYmxlKSB7XG4gICAgICB0aGlzLmxvYWRlZCA9IGV2ZW50LmxvYWRlZDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgWGhyTG9hZGVyO1xuIl19
