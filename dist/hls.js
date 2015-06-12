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

var ERROR = -2;
var STARTING = -1;
var IDLE = 0;
var LOADING = 1;
var WAITING_LEVEL = 2;
var PARSING = 3;
var PARSED = 4;
var APPENDING = 5;
var BUFFER_FLUSHING = 6;

var BufferController = (function () {
  function BufferController(levelController, config) {
    _classCallCheck(this, BufferController);

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
      this.state = IDLE;
    }
  }, {
    key: 'start',
    value: function start() {
      this.startInternal();
      if (this.lastCurrentTime) {
        _utilsLogger.logger.log('resuming video @ ' + this.lastCurrentTime);
        this.startPosition = this.lastCurrentTime;
        this.state = IDLE;
      } else {
        this.state = STARTING;
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
      var pos, loadLevel, loadLevelDetails, fragIdx;
      switch (this.state) {
        case ERROR:
          //don't do anything in error state to avoid breaking further ...
          break;
        case STARTING:
          // determine load level
          this.startLevel = this.levelController.startLevel;
          if (this.startLevel === -1) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            this.startLevel = 0;
            this.fragmentBitrateTest = true;
          }
          // set new level to playlist loader : this will trigger start level load
          this.levelController.level = this.startLevel;
          this.state = WAITING_LEVEL;
          this.loadedmetadata = false;
          break;
        case IDLE:
          // handle end of immediate switching if needed
          if (this.immediateSwitch) {
            this.immediateLevelSwitchEnd();
            break;
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
            loadLevel = this.startLevel;
          } else {
            // we are not at playback start, get next load level from level Controller
            loadLevel = this.levelController.nextLevel();
          }
          var bufferInfo = this.bufferInfo(pos),
              bufferLen = bufferInfo.len,
              bufferEnd = bufferInfo.end,
              maxBufLen;
          // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
          if (this.levels[loadLevel].hasOwnProperty('bitrate')) {
            maxBufLen = Math.max(8 * this.config.maxBufferSize / this.levels[loadLevel].bitrate, this.config.maxBufferLength);
          } else {
            maxBufLen = this.config.maxBufferLength;
          }
          // if buffer length is less than maxBufLen try to load a new fragment
          if (bufferLen < maxBufLen) {
            if (loadLevel !== this.level) {
              // set new level to playlist loader : this will trigger a playlist load if needed
              this.levelController.level = loadLevel;
              // tell demuxer that we will switch level (this will force init segment to be regenerated)
              if (this.demuxer) {
                this.demuxer.switchLevel();
              }
            }
            loadLevelDetails = this.levels[loadLevel].details;
            // if level details retrieved yet, switch state and wait for level retrieval
            if (typeof loadLevelDetails === 'undefined') {
              this.state = WAITING_LEVEL;
              break;
            }
            // find fragment index, contiguous with end of buffer position
            var fragments = loadLevelDetails.fragments,
                frag,
                sliding = loadLevelDetails.sliding,
                start = fragments[0].start + sliding;
            // check if requested position is within seekable boundaries :
            // in case of live playlist we need to ensure that requested position is not located before playlist start
            if (bufferEnd < start) {
              if (this.video.seeking === false) {
                _utilsLogger.logger.log('requested position: ' + bufferEnd + ' is before start of playlist, reset video position to start: ' + start);
                this.video.currentTime = start + 0.01;
                break;
              } else {
                bufferEnd = start + 0.01;
              }
            }
            //look for fragments matching with current play position
            for (fragIdx = 0; fragIdx < fragments.length; fragIdx++) {
              frag = fragments[fragIdx];
              start = frag.start + sliding;
              //logger.log(`level/sn/sliding/start/end/bufEnd:${loadLevel}/${frag.sn}/${sliding}/${start}/${start+frag.duration}/${bufferEnd}`);
              // offset should be within fragment boundary
              if (start <= bufferEnd && start + frag.duration > bufferEnd) {
                break;
              }
              //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
            }
            if (fragIdx >= 0 && fragIdx < fragments.length) {
              if (this.frag && frag.sn === this.frag.sn) {
                if (fragIdx === fragments.length - 1) {
                  // we are at the end of the playlist and we already loaded last fragment, don't do anything
                  break;
                } else {
                  frag = fragments[fragIdx + 1];
                  _utilsLogger.logger.log('SN just loaded, load next one: ' + frag.sn);
                }
              }
              _utilsLogger.logger.log('Loading       ' + frag.sn + ' of [' + fragments[0].sn + ' ,' + fragments[fragments.length - 1].sn + '],level ' + loadLevel);
              //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));

              this.frag = frag;
              this.level = loadLevel;
              this.fragmentLoader.load(frag);
              this.state = LOADING;
            }
          }
          break;
        case WAITING_LEVEL:
          var level = this.levels[this.level];
          // check if playlist is already loaded
          if (level && level.details) {
            this.state = IDLE;
          }
          break;
        case LOADING:
        // nothing to do, wait for fragment retrieval
        case PARSING:
          // nothing to do, wait for fragment being parsed
          break;
        case PARSED:
        case APPENDING:
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
                  this.state = ERROR;
                  return;
                }
              }
              this.state = APPENDING;
            }
          }
          break;
        case BUFFER_FLUSHING:
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
            this.state = IDLE;
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
      this.state = BUFFER_FLUSHING;
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
        this.state = BUFFER_FLUSHING;
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
      if (this.state === LOADING) {
        // check if currently loaded fragment is inside buffer.
        //if outside, cancel fragment loading, otherwise do nothing
        if (this.bufferInfo(this.video.currentTime).len === 0) {
          _utilsLogger.logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
          this.fragmentLoader.abort();
          this.frag = null;
          this.state = IDLE;
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
            _utilsLogger.logger.log('cannot compute sliding, no SN in common between old:[' + oldfragments[0].sn + ',' + oldfragments[oldfragments.length - 1].sn + '/new level [' + fragments[0].sn + ',' + fragments[fragments.length - 1].sn + ']');
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
      this.demuxer.setDuration(duration);
      if (this.startLevelLoaded === false) {
        // if live playlist, set start position to be fragment N-3
        if (data.details.live) {
          this.startPosition = Math.max(0, duration - 3 * data.details.targetduration);
        }
        this.nextLoadPosition = this.startPosition;
        this.startLevelLoaded = true;
      }
      // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
      if (this.state === WAITING_LEVEL) {
        this.state = IDLE;
      }
      //trigger handler right now
      this.tick();
    }
  }, {
    key: 'onFragmentLoaded',
    value: function onFragmentLoaded(event, data) {
      if (this.state === LOADING) {
        if (this.fragmentBitrateTest === true) {
          // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
          this.state = IDLE;
          this.fragmentBitrateTest = false;
          data.stats.tparsed = data.stats.tbuffered = new Date();
          _observer2['default'].trigger(_events2['default'].FRAG_BUFFERED, { stats: data.stats, frag: this.frag });
          this.frag = null;
        } else {
          this.state = PARSING;
          // transmux the MPEG-TS data to ISO-BMFF segments
          this.stats = data.stats;
          this.demuxer.setDuration(this.levels[this.level].details.totalduration);
          this.demuxer.push(data.payload, this.levels[this.level].audioCodec, this.levels[this.level].videoCodec, this.frag.start);
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
      this.state = PARSED;
      this.stats.tparsed = new Date();
      //trigger handler right now
      this.tick();
    }
  }, {
    key: 'onFragmentLoadError',
    value: function onFragmentLoadError() {
      _utilsLogger.logger.log('buffer controller: error while loading frag, retry ...');
      this.state = IDLE;
      this.frag = null;
    }
  }, {
    key: 'onFragmentLoadTimeout',
    value: function onFragmentLoadTimeout() {
      _utilsLogger.logger.log('buffer controller: timeout while loading frag, retry ...');
      this.state = IDLE;
      this.frag = null;
    }
  }, {
    key: 'onSourceBufferUpdateEnd',
    value: function onSourceBufferUpdateEnd() {
      //trigger handler right now
      if (this.state === APPENDING && this.mp4segments.length === 0) {
        this.stats.tbuffered = new Date();
        _observer2['default'].trigger(_events2['default'].FRAG_BUFFERED, { stats: this.stats, frag: this.frag });
        this.state = IDLE;
      }
      this.tick();
    }
  }, {
    key: 'onSourceBufferError',
    value: function onSourceBufferError(event) {
      _utilsLogger.logger.log('sourceBuffer error:' + event);
      this.state = ERROR;
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
    this.ontick = this.tick.bind(this);
    _observer2['default'].on(_events2['default'].MANIFEST_LOADED, this.onml);
    _observer2['default'].on(_events2['default'].FRAG_LOADED, this.onfl);
    _observer2['default'].on(_events2['default'].FRAG_LOAD_ERROR, this.onfle);
    _observer2['default'].on(_events2['default'].FRAG_LOAD_TIMEOUT, this.onflt);
    _observer2['default'].on(_events2['default'].LEVEL_LOADED, this.onll);
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
  // Identifier for fragment load error - data: { url : faulty URL, response : XHR response}
  FRAG_LOAD_ERROR: 'hlsFragLoadError',
  // Identifier for fragment load timeout - data: { url : faulty URL, response : XHR response}
  FRAG_LOAD_TIMEOUT: 'hlsFragLoadTimeOut',
  // Identifier for playlist load error - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_ERROR: 'hlsLevelLoadError',
  // Identifier for playlist load timeout - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_TIMEOUT: 'hlsLevelLoadTimeOut',
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_ERROR: 'hlsLevelError',
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
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 500,
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 6,
      manifestLoadingRetryDelay: 500,
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

},{"./events":9,"./observer":13}],16:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2V2ZW50cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvaGxzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvcGxheWxpc3QtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9vYnNlcnZlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvc3RhdHMuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL3V0aWxzL2xvZ2dlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMveGhyLWxvYWRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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LENBQUMsQ0FDbEIsQ0FBQyxDQUFDO0FBQ0gsU0FBRyxDQUFDLFVBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUM5QixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNqQixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNqQixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNqQixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUNsQixDQUFDLENBQUM7QUFDSCxTQUFHLENBQUMsYUFBYSxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRCxTQUFHLENBQUMsVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLENBQzlCLENBQUk7QUFDSixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJO0FBQ3RCLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFFBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFDdEIsR0FBSSxFQUFFLEVBQUksRUFBRSxFQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsQ0FBSTtPQUM3QixDQUFDLENBQUM7QUFDSCxTQUFHLENBQUMsVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLENBQzlCLENBQUk7QUFDSixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsR0FBSSxFQUFF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QUFJLEVBQUUsRUFDZixBQUFDLFFBQVEsSUFBSSxFQUFFLEdBQUksR0FBSSxFQUN2QixBQUFDLFFBQVEsSUFBSyxDQUFDLEdBQUksR0FBSSxFQUN2QixRQUFRLEdBQUcsR0FBSTtBQUNmLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsT0FBSSxFQUFFLENBQUk7QUFDVixPQUFJLEVBQUUsQ0FBSTtBQUNWLE9BQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsT0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsRUFBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixPQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJO09BQ3ZCLENBQUMsQ0FBQztBQUNMLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztLQUN2Qzs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsVUFDRSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxFQUFFO1VBQzdCLEtBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztVQUMxQyxLQUFLO1VBQ0wsQ0FBQyxDQUFDOzs7OztBQUtKLFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNuQyxhQUFLLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUN6QixhQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEFBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLEdBQ2pDLEtBQUssQ0FBQyxZQUFZLElBQUksQ0FBQyxBQUFDLEdBQ3hCLEtBQUssQ0FBQyxhQUFhLEFBQUMsQ0FBQztPQUN6Qjs7QUFFRCxhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQ2xCLEtBQUssQ0FBQyxDQUFDO0tBQ25COzs7V0FFVSxjQUFDLEtBQUssRUFBRTtBQUNqQixhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQ2xCLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQ2YsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQ2pDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUNqQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFDakMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUMvQzs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsVUFBSSxHQUFHLEdBQUcsRUFBRTtVQUFFLEdBQUcsR0FBRyxFQUFFO1VBQUUsQ0FBQyxDQUFDOztBQUUxQixXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLFdBQUcsQ0FBQyxJQUFJLENBQUMsQUFBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsS0FBSyxDQUFDLEdBQUksR0FBSSxDQUFDLENBQUM7QUFDakQsV0FBRyxDQUFDLElBQUksQ0FBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsR0FBRyxHQUFJLENBQUUsQ0FBQztBQUMzQyxXQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDNUQ7OztBQUdELFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDckMsV0FBRyxDQUFDLElBQUksQ0FBQyxBQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxLQUFLLENBQUMsR0FBSSxHQUFJLENBQUMsQ0FBQztBQUNqRCxXQUFHLENBQUMsSUFBSSxDQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxH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QjtLQUNGOzs7U0E5RUksU0FBUzs7O3FCQWlGRCxTQUFTIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuICAgIFxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICBpZiAoY2FjaGVba2V5XS5leHBvcnRzID09PSBmbikge1xuICAgICAgICAgICAgd2tleSA9IGtleTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgXG4gICAgdmFyIHNjYWNoZSA9IHt9OyBzY2FjaGVbd2tleV0gPSB3a2V5O1xuICAgIHNvdXJjZXNbc2tleV0gPSBbXG4gICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZSddLCdyZXF1aXJlKCcgKyBzdHJpbmdpZnkod2tleSkgKyAnKShzZWxmKScpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuICAgIFxuICAgIHZhciBzcmMgPSAnKCcgKyBidW5kbGVGbiArICcpKHsnXG4gICAgICAgICsgT2JqZWN0LmtleXMoc291cmNlcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdpZnkoa2V5KSArICc6WydcbiAgICAgICAgICAgICAgICArIHNvdXJjZXNba2V5XVswXVxuICAgICAgICAgICAgICAgICsgJywnICsgc3RyaW5naWZ5KHNvdXJjZXNba2V5XVsxXSkgKyAnXSdcbiAgICAgICAgICAgIDtcbiAgICAgICAgfSkuam9pbignLCcpXG4gICAgICAgICsgJ30se30sWycgKyBzdHJpbmdpZnkoc2tleSkgKyAnXSknXG4gICAgO1xuICAgIFxuICAgIHZhciBVUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkw7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogYnVmZmVyIGNvbnRyb2xsZXJcbiAqXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBGcmFnbWVudExvYWRlciAgICAgICBmcm9tICcuLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCBEZW11eGVyICAgICAgICAgICAgICBmcm9tICcuLi9kZW11eC9kZW11eGVyJztcblxuICBjb25zdCBFUlJPUiA9IC0yO1xuICBjb25zdCBTVEFSVElORyA9IC0xO1xuICBjb25zdCBJRExFID0gMDtcbiAgY29uc3QgTE9BRElORyA9ICAxO1xuICBjb25zdCBXQUlUSU5HX0xFVkVMID0gMjtcbiAgY29uc3QgUEFSU0lORyA9IDM7XG4gIGNvbnN0IFBBUlNFRCA9IDQ7XG4gIGNvbnN0IEFQUEVORElORyA9IDU7XG4gIGNvbnN0IEJVRkZFUl9GTFVTSElORyA9IDY7XG5cbiBjbGFzcyBCdWZmZXJDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihsZXZlbENvbnRyb2xsZXIsY29uZmlnKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBsZXZlbENvbnRyb2xsZXI7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgdGhpcy5zdGFydFBvc2l0aW9uID0gMDtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKGNvbmZpZyk7XG4gICAgLy8gU291cmNlIEJ1ZmZlciBsaXN0ZW5lcnNcbiAgICB0aGlzLm9uc2J1ZSA9IHRoaXMub25Tb3VyY2VCdWZmZXJVcGRhdGVFbmQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uc2JlICA9IHRoaXMub25Tb3VyY2VCdWZmZXJFcnJvci5iaW5kKHRoaXMpO1xuICAgIC8vIGludGVybmFsIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTVNFQXR0YWNoZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXAgPSB0aGlzLm9uTWFuaWZlc3RQYXJzZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmwgPSB0aGlzLm9uRnJhZ21lbnRMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uaXMgPSB0aGlzLm9uSW5pdFNlZ21lbnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZnBnID0gdGhpcy5vbkZyYWdtZW50UGFyc2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcCA9IHRoaXMub25GcmFnbWVudFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbHQgPSB0aGlzLm9uRnJhZ21lbnRMb2FkVGltZW91dC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbGUgPSB0aGlzLm9uRnJhZ21lbnRMb2FkRXJyb3IuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1TRV9BVFRBQ0hFRCwgdGhpcy5vbm1zZSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICB9XG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICAgIC8vIHJlbW92ZSB2aWRlbyBsaXN0ZW5lclxuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2luZycsdGhpcy5vbnZzZWVraW5nKTtcbiAgICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2VkJyx0aGlzLm9udnNlZWtlZCk7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJyx0aGlzLm9udm1ldGFkYXRhKTtcbiAgICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub252c2Vla2VkID0gdGhpcy5vbnZtZXRhZGF0YSA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICB9XG5cbiAgc3RhcnQoKSB7XG4gICAgdGhpcy5zdGFydEludGVybmFsKCk7XG4gICAgaWYodGhpcy5sYXN0Q3VycmVudFRpbWUpIHtcbiAgICAgIGxvZ2dlci5sb2coYHJlc3VtaW5nIHZpZGVvIEAgJHt0aGlzLmxhc3RDdXJyZW50VGltZX1gKTtcbiAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lO1xuICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTVEFSVElORztcbiAgICB9XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBzdGFydEludGVybmFsKCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVyKHRoaXMuY29uZmlnKTtcbiAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMCk7XG4gICAgdGhpcy5hcHBlbmRFcnJvcj0wO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfTE9BRF9FUlJPUiwgdGhpcy5vbmZsZSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FEX1RJTUVPVVQsIHRoaXMub25mbHQpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgfVxuXG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLm1wNHNlZ21lbnRzID0gW107XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IFtdO1xuICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICBpZih0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHZhciBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlU291cmNlQnVmZmVyKHNiKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcblxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy5kZW11eGVyKSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkZSQUdfTE9BRF9FUlJPUiwgdGhpcy5vbmZsZSk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FEX1RJTUVPVVQsIHRoaXMub25mbHQpO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgcG9zLGxvYWRMZXZlbCxsb2FkTGV2ZWxEZXRhaWxzLGZyYWdJZHg7XG4gICAgc3dpdGNoKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgRVJST1I6XG4gICAgICAgIC8vZG9uJ3QgZG8gYW55dGhpbmcgaW4gZXJyb3Igc3RhdGUgdG8gYXZvaWQgYnJlYWtpbmcgZnVydGhlciAuLi5cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFNUQVJUSU5HOlxuICAgICAgICAvLyBkZXRlcm1pbmUgbG9hZCBsZXZlbFxuICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsO1xuICAgICAgICBpZiAodGhpcy5zdGFydExldmVsID09PSAtMSkge1xuICAgICAgICAgIC8vIC0xIDogZ3Vlc3Mgc3RhcnQgTGV2ZWwgYnkgZG9pbmcgYSBiaXRyYXRlIHRlc3QgYnkgbG9hZGluZyBmaXJzdCBmcmFnbWVudCBvZiBsb3dlc3QgcXVhbGl0eSBsZXZlbFxuICAgICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IDA7XG4gICAgICAgICAgdGhpcy5mcmFnbWVudEJpdHJhdGVUZXN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBzZXQgbmV3IGxldmVsIHRvIHBsYXlsaXN0IGxvYWRlciA6IHRoaXMgd2lsbCB0cmlnZ2VyIHN0YXJ0IGxldmVsIGxvYWRcbiAgICAgICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBXQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBJRExFOlxuICAgICAgICAvLyBoYW5kbGUgZW5kIG9mIGltbWVkaWF0ZSBzd2l0Y2hpbmcgaWYgbmVlZGVkXG4gICAgICAgIGlmKHRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICAgICAgdGhpcy5pbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGNhbmRpZGF0ZSBmcmFnbWVudCB0byBiZSBsb2FkZWQsIGJhc2VkIG9uIGN1cnJlbnQgcG9zaXRpb24gYW5kXG4gICAgICAgIC8vICBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgIC8vICBlbnN1cmUgNjBzIG9mIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIHdlIGhhdmUgbm90IHlldCBsb2FkZWQgYW55IGZyYWdtZW50LCBzdGFydCBsb2FkaW5nIGZyb20gc3RhcnQgcG9zaXRpb25cbiAgICAgICAgaWYodGhpcy5sb2FkZWRtZXRhZGF0YSkge1xuICAgICAgICAgIHBvcyA9IHRoaXMudmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5uZXh0TG9hZFBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGxvYWQgbGV2ZWxcbiAgICAgICAgaWYodGhpcy5zdGFydEZyYWdtZW50TG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxvYWRMZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB3ZSBhcmUgbm90IGF0IHBsYXliYWNrIHN0YXJ0LCBnZXQgbmV4dCBsb2FkIGxldmVsIGZyb20gbGV2ZWwgQ29udHJvbGxlclxuICAgICAgICAgIGxvYWRMZXZlbCA9IHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMZXZlbCgpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBidWZmZXJJbmZvID0gdGhpcy5idWZmZXJJbmZvKHBvcyksIGJ1ZmZlckxlbiA9IGJ1ZmZlckluZm8ubGVuLCBidWZmZXJFbmQgPSBidWZmZXJJbmZvLmVuZCwgbWF4QnVmTGVuO1xuICAgICAgICAvLyBjb21wdXRlIG1heCBCdWZmZXIgTGVuZ3RoIHRoYXQgd2UgY291bGQgZ2V0IGZyb20gdGhpcyBsb2FkIGxldmVsLCBiYXNlZCBvbiBsZXZlbCBiaXRyYXRlLiBkb24ndCBidWZmZXIgbW9yZSB0aGFuIDYwIE1CIGFuZCBtb3JlIHRoYW4gMzBzXG4gICAgICAgIGlmKCh0aGlzLmxldmVsc1tsb2FkTGV2ZWxdKS5oYXNPd25Qcm9wZXJ0eSgnYml0cmF0ZScpKSB7XG4gICAgICAgICAgbWF4QnVmTGVuID0gTWF0aC5tYXgoOCp0aGlzLmNvbmZpZy5tYXhCdWZmZXJTaXplL3RoaXMubGV2ZWxzW2xvYWRMZXZlbF0uYml0cmF0ZSx0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IHRoaXMuY29uZmlnLm1heEJ1ZmZlckxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBidWZmZXIgbGVuZ3RoIGlzIGxlc3MgdGhhbiBtYXhCdWZMZW4gdHJ5IHRvIGxvYWQgYSBuZXcgZnJhZ21lbnRcbiAgICAgICAgaWYoYnVmZmVyTGVuIDwgbWF4QnVmTGVuKSB7XG4gICAgICAgICAgaWYobG9hZExldmVsICE9PSB0aGlzLmxldmVsKSB7XG4gICAgICAgICAgICAvLyBzZXQgbmV3IGxldmVsIHRvIHBsYXlsaXN0IGxvYWRlciA6IHRoaXMgd2lsbCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZCBpZiBuZWVkZWRcbiAgICAgICAgICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsID0gbG9hZExldmVsO1xuICAgICAgICAgICAgLy8gdGVsbCBkZW11eGVyIHRoYXQgd2Ugd2lsbCBzd2l0Y2ggbGV2ZWwgKHRoaXMgd2lsbCBmb3JjZSBpbml0IHNlZ21lbnQgdG8gYmUgcmVnZW5lcmF0ZWQpXG4gICAgICAgICAgICBpZiAodGhpcy5kZW11eGVyKSB7XG4gICAgICAgICAgICAgIHRoaXMuZGVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBsb2FkTGV2ZWxEZXRhaWxzID0gdGhpcy5sZXZlbHNbbG9hZExldmVsXS5kZXRhaWxzO1xuICAgICAgICAgIC8vIGlmIGxldmVsIGRldGFpbHMgcmV0cmlldmVkIHlldCwgc3dpdGNoIHN0YXRlIGFuZCB3YWl0IGZvciBsZXZlbCByZXRyaWV2YWxcbiAgICAgICAgICBpZih0eXBlb2YgbG9hZExldmVsRGV0YWlscyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBXQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgdmFyIGZyYWdtZW50cyA9IGxvYWRMZXZlbERldGFpbHMuZnJhZ21lbnRzLCBmcmFnLCBzbGlkaW5nID0gbG9hZExldmVsRGV0YWlscy5zbGlkaW5nLCBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCArIHNsaWRpbmc7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAvLyBpbiBjYXNlIG9mIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byBlbnN1cmUgdGhhdCByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgbm90IGxvY2F0ZWQgYmVmb3JlIHBsYXlsaXN0IHN0YXJ0XG4gICAgICAgICAgaWYoYnVmZmVyRW5kIDwgc3RhcnQpIHtcbiAgICAgICAgICAgIGlmKHRoaXMudmlkZW8uc2Vla2luZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgcmVxdWVzdGVkIHBvc2l0aW9uOiAke2J1ZmZlckVuZH0gaXMgYmVmb3JlIHN0YXJ0IG9mIHBsYXlsaXN0LCByZXNldCB2aWRlbyBwb3NpdGlvbiB0byBzdGFydDogJHtzdGFydH1gKTtcbiAgICAgICAgICAgICAgdGhpcy52aWRlby5jdXJyZW50VGltZSA9IHN0YXJ0ICsgMC4wMTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBidWZmZXJFbmQgPSBzdGFydCArIDAuMDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vbG9vayBmb3IgZnJhZ21lbnRzIG1hdGNoaW5nIHdpdGggY3VycmVudCBwbGF5IHBvc2l0aW9uXG4gICAgICAgICAgZm9yIChmcmFnSWR4ID0gMDsgZnJhZ0lkeCA8IGZyYWdtZW50cy5sZW5ndGggOyBmcmFnSWR4KyspIHtcbiAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeF07XG4gICAgICAgICAgICBzdGFydCA9IGZyYWcuc3RhcnQrc2xpZGluZztcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgbGV2ZWwvc24vc2xpZGluZy9zdGFydC9lbmQvYnVmRW5kOiR7bG9hZExldmVsfS8ke2ZyYWcuc259LyR7c2xpZGluZ30vJHtzdGFydH0vJHtzdGFydCtmcmFnLmR1cmF0aW9ufS8ke2J1ZmZlckVuZH1gKTtcbiAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5XG4gICAgICAgICAgICBpZihzdGFydCA8PSBidWZmZXJFbmQgJiYgKHN0YXJ0ICsgZnJhZy5kdXJhdGlvbikgPiBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgU04gbWF0Y2hpbmcgd2l0aCBwb3M6JyArICBidWZmZXJFbmQgKyAnOicgKyBmcmFnLnNuKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZnJhZ0lkeCA+PSAwICYmIGZyYWdJZHggPCBmcmFnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZih0aGlzLmZyYWcgJiYgZnJhZy5zbiA9PT0gdGhpcy5mcmFnLnNuKSB7XG4gICAgICAgICAgICAgIGlmKGZyYWdJZHggPT09IChmcmFnbWVudHMubGVuZ3RoIC0xKSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGFyZSBhdCB0aGUgZW5kIG9mIHRoZSBwbGF5bGlzdCBhbmQgd2UgYWxyZWFkeSBsb2FkZWQgbGFzdCBmcmFnbWVudCwgZG9uJ3QgZG8gYW55dGhpbmdcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHgrMV07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgU04ganVzdCBsb2FkZWQsIGxvYWQgbmV4dCBvbmU6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyAgICAgICAke2ZyYWcuc259IG9mIFske2ZyYWdtZW50c1swXS5zbn0gLCR7ZnJhZ21lbnRzW2ZyYWdtZW50cy5sZW5ndGgtMV0uc259XSxsZXZlbCAke2xvYWRMZXZlbH1gKTtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnICAgICAgbG9hZGluZyBmcmFnICcgKyBpICsnLHBvcy9idWZFbmQ6JyArIHBvcy50b0ZpeGVkKDMpICsgJy8nICsgYnVmZmVyRW5kLnRvRml4ZWQoMykpO1xuXG4gICAgICAgICAgICB0aGlzLmZyYWcgPSBmcmFnO1xuICAgICAgICAgICAgdGhpcy5sZXZlbCA9IGxvYWRMZXZlbDtcbiAgICAgICAgICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIubG9hZChmcmFnKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBMT0FESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgV0FJVElOR19MRVZFTDpcbiAgICAgICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgICAgIC8vIGNoZWNrIGlmIHBsYXlsaXN0IGlzIGFscmVhZHkgbG9hZGVkXG4gICAgICAgIGlmKGxldmVsICYmIGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgTE9BRElORzpcbiAgICAgICAgLy8gbm90aGluZyB0byBkbywgd2FpdCBmb3IgZnJhZ21lbnQgcmV0cmlldmFsXG4gICAgICBjYXNlIFBBUlNJTkc6XG4gICAgICAgIC8vIG5vdGhpbmcgdG8gZG8sIHdhaXQgZm9yIGZyYWdtZW50IGJlaW5nIHBhcnNlZFxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgUEFSU0VEOlxuICAgICAgY2FzZSBBUFBFTkRJTkc6XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICAgIC8vIGlmIE1QNCBzZWdtZW50IGFwcGVuZGluZyBpbiBwcm9ncmVzcyBub3RoaW5nIHRvIGRvXG4gICAgICAgICAgaWYoKHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvICYmIHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvLnVwZGF0aW5nKSB8fFxuICAgICAgICAgICAgICh0aGlzLnNvdXJjZUJ1ZmZlci52aWRlbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci52aWRlby51cGRhdGluZykpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnc2IgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgIC8vIGNoZWNrIGlmIGFueSBNUDQgc2VnbWVudHMgbGVmdCB0byBhcHBlbmRcbiAgICAgICAgICB9IGVsc2UgaWYodGhpcy5tcDRzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBzZWdtZW50ID0gdGhpcy5tcDRzZWdtZW50cy5zaGlmdCgpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBhcHBlbmRpbmcgJHtzZWdtZW50LnR5cGV9IFNCLCBzaXplOiR7c2VnbWVudC5kYXRhLmxlbmd0aH1gKTtcbiAgICAgICAgICAgICAgdGhpcy5zb3VyY2VCdWZmZXJbc2VnbWVudC50eXBlXS5hcHBlbmRCdWZmZXIoc2VnbWVudC5kYXRhKTtcbiAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvcj0wO1xuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgLy8gaW4gY2FzZSBhbnkgZXJyb3Igb2NjdXJlZCB3aGlsZSBhcHBlbmRpbmcsIHB1dCBiYWNrIHNlZ21lbnQgaW4gbXA0c2VnbWVudHMgdGFibGVcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZXJyb3Igd2hpbGUgdHJ5aW5nIHRvIGFwcGVuZCBidWZmZXI6JHtlcnIubWVzc2FnZX0sdHJ5IGFwcGVuZGluZyBsYXRlcmApO1xuICAgICAgICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnVuc2hpZnQoc2VnbWVudCk7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IrKztcbiAgICAgICAgICAgICAgaWYodGhpcy5hcHBlbmRFcnJvciA+IDMpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmYWlsIDMgdGltZXMgdG8gYXBwZW5kIHNlZ21lbnQgaW4gc291cmNlQnVmZmVyYCk7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0FQUEVORElOR19FUlJPUiwge2ZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gRVJST1I7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gQVBQRU5ESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQlVGRkVSX0ZMVVNISU5HOlxuICAgICAgICAvLyBsb29wIHRocm91Z2ggYWxsIGJ1ZmZlciByYW5nZXMgdG8gZmx1c2hcbiAgICAgICAgd2hpbGUodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCkge1xuICAgICAgICAgIHZhciByYW5nZSA9IHRoaXMuZmx1c2hSYW5nZVswXTtcbiAgICAgICAgICAvLyBmbHVzaEJ1ZmZlciB3aWxsIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzIGFuZCBmbHVzaCBBdWRpby9WaWRlbyBCdWZmZXJcbiAgICAgICAgICBpZih0aGlzLmZsdXNoQnVmZmVyKHJhbmdlLnN0YXJ0LHJhbmdlLmVuZCkpIHtcbiAgICAgICAgICAgIC8vIHJhbmdlIGZsdXNoZWQsIHJlbW92ZSBmcm9tIGZsdXNoIGFycmF5XG4gICAgICAgICAgICB0aGlzLmZsdXNoUmFuZ2Uuc2hpZnQoKTtcbiAgICAgICAgICAgIC8vIHJlc2V0IGZsdXNoIGNvdW50ZXJcbiAgICAgICAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmx1c2ggaW4gcHJvZ3Jlc3MsIGNvbWUgYmFjayBsYXRlclxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIC8vIG1vdmUgdG8gSURMRSBvbmNlIGZsdXNoIGNvbXBsZXRlLiB0aGlzIHNob3VsZCB0cmlnZ2VyIG5ldyBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgICAgICAgLy8gcmVzZXQgcmVmZXJlbmNlIHRvIGZyYWdcbiAgICAgICAgICB0aGlzLmZyYWcgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgICAvKiBpZiBub3QgZXZlcnl0aGluZyBmbHVzaGVkLCBzdGF5IGluIEJVRkZFUl9GTFVTSElORyBzdGF0ZS4gd2Ugd2lsbCBjb21lIGJhY2sgaGVyZVxuICAgICAgICAgICAgZWFjaCB0aW1lIHNvdXJjZUJ1ZmZlciB1cGRhdGVlbmQoKSBjYWxsYmFjayB3aWxsIGJlIHRyaWdnZXJlZFxuICAgICAgICAgICAgKi9cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLy8gY2hlY2svdXBkYXRlIGN1cnJlbnQgZnJhZ21lbnRcbiAgICB0aGlzLl9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpO1xuICB9XG5cbiAgIGJ1ZmZlckluZm8ocG9zKSB7XG4gICAgdmFyIHYgPSB0aGlzLnZpZGVvLFxuICAgICAgICBidWZmZXJlZCA9IHYuYnVmZmVyZWQsXG4gICAgICAgIGJ1ZmZlckxlbixcbiAgICAgICAgLy8gYnVmZmVyU3RhcnQgYW5kIGJ1ZmZlckVuZCBhcmUgYnVmZmVyIGJvdW5kYXJpZXMgYXJvdW5kIGN1cnJlbnQgdmlkZW8gcG9zaXRpb25cbiAgICAgICAgYnVmZmVyU3RhcnQsYnVmZmVyRW5kLFxuICAgICAgICBpO1xuICAgIHZhciBidWZmZXJlZDIgPSBbXTtcbiAgICAvLyB0aGVyZSBtaWdodCBiZSBzb21lIHNtYWxsIGhvbGVzIGJldHdlZW4gYnVmZmVyIHRpbWUgcmFuZ2VcbiAgICAvLyBjb25zaWRlciB0aGF0IGhvbGVzIHNtYWxsZXIgdGhhbiAzMDAgbXMgYXJlIGlycmVsZXZhbnQgYW5kIGJ1aWxkIGFub3RoZXJcbiAgICAvLyBidWZmZXIgdGltZSByYW5nZSByZXByZXNlbnRhdGlvbnMgdGhhdCBkaXNjYXJkcyB0aG9zZSBob2xlc1xuICAgIGZvcihpID0gMCA7IGkgPCBidWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgIC8vbG9nZ2VyLmxvZygnYnVmIHN0YXJ0L2VuZDonICsgYnVmZmVyZWQuc3RhcnQoaSkgKyAnLycgKyBidWZmZXJlZC5lbmQoaSkpO1xuICAgICAgaWYoKGJ1ZmZlcmVkMi5sZW5ndGgpICYmIChidWZmZXJlZC5zdGFydChpKSAtIGJ1ZmZlcmVkMltidWZmZXJlZDIubGVuZ3RoLTFdLmVuZCApIDwgMC4zKSB7XG4gICAgICAgIGJ1ZmZlcmVkMltidWZmZXJlZDIubGVuZ3RoLTFdLmVuZCA9IGJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJ1ZmZlcmVkMi5wdXNoKHtzdGFydCA6IGJ1ZmZlcmVkLnN0YXJ0KGkpLGVuZCA6IGJ1ZmZlcmVkLmVuZChpKX0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvcihpID0gMCwgYnVmZmVyTGVuID0gMCwgYnVmZmVyU3RhcnQgPSBidWZmZXJFbmQgPSBwb3MgOyBpIDwgYnVmZmVyZWQyLmxlbmd0aCA7IGkrKykge1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZigocG9zKzAuMykgPj0gYnVmZmVyZWQyW2ldLnN0YXJ0ICYmIHBvcyA8IGJ1ZmZlcmVkMltpXS5lbmQpIHtcbiAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyZWQyW2ldLnN0YXJ0O1xuICAgICAgICBidWZmZXJFbmQgPSBidWZmZXJlZDJbaV0uZW5kICsgMC4zO1xuICAgICAgICBidWZmZXJMZW4gPSBidWZmZXJFbmQgLSBwb3M7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7bGVuIDogYnVmZmVyTGVuLCBzdGFydCA6IGJ1ZmZlclN0YXJ0LCBlbmQgOiBidWZmZXJFbmR9O1xuICB9XG5cblxuICBnZXRCdWZmZXJSYW5nZShwb3NpdGlvbikge1xuICAgIHZhciBpLHJhbmdlO1xuICAgIGZvciAoaSA9IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoLTE7IGkgPj0wIDsgaS0tKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZihwb3NpdGlvbiA+PSByYW5nZS5zdGFydCAmJiBwb3NpdGlvbiA8PSByYW5nZS5lbmQpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgZ2V0IGN1cnJlbnRMZXZlbCgpIHtcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUpO1xuICAgICAgaWYocmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIGdldCBuZXh0QnVmZmVyUmFuZ2UoKSB7XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgLy8gZmlyc3QgZ2V0IGVuZCByYW5nZSBvZiBjdXJyZW50IGZyYWdtZW50XG4gICAgICByZXR1cm4gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZSh0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgZm9sbG93aW5nQnVmZmVyUmFuZ2UocmFuZ2UpIHtcbiAgICBpZihyYW5nZSkge1xuICAgICAgLy8gdHJ5IHRvIGdldCByYW5nZSBvZiBuZXh0IGZyYWdtZW50ICg1MDBtcyBhZnRlciB0aGlzIHJhbmdlKVxuICAgICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyUmFuZ2UocmFuZ2UuZW5kKzAuNSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cblxuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHZhciByYW5nZSA9IHRoaXMubmV4dEJ1ZmZlclJhbmdlO1xuICAgIGlmKHJhbmdlKSB7XG4gICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgfVxuXG4gIGlzQnVmZmVyZWQocG9zaXRpb24pIHtcbiAgICB2YXIgdiA9IHRoaXMudmlkZW8sYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkO1xuICAgIGZvcih2YXIgaSA9IDAgOyBpIDwgYnVmZmVyZWQubGVuZ3RoIDsgaSsrKSB7XG4gICAgICBpZihwb3NpdGlvbiA+PSBidWZmZXJlZC5zdGFydChpKSAmJiBwb3NpdGlvbiA8PSBidWZmZXJlZC5lbmQoaSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIF9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpIHtcbiAgICB2YXIgcmFuZ2VDdXJyZW50LCBjdXJyZW50VGltZTtcbiAgICBpZih0aGlzLnZpZGVvICYmIHRoaXMudmlkZW8uc2Vla2luZyA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gY3VycmVudFRpbWUgPSB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgaWYodGhpcy5pc0J1ZmZlcmVkKGN1cnJlbnRUaW1lKSkge1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZihyYW5nZUN1cnJlbnQpIHtcbiAgICAgIGlmKHJhbmdlQ3VycmVudC5mcmFnICE9PSB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSByYW5nZUN1cnJlbnQuZnJhZztcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0NIQU5HRUQsIHsgZnJhZyA6IHRoaXMuZnJhZ0N1cnJlbnQgfSk7XG4gICAgICAgIC8vIGlmKHRoaXMuZnJhZ0N1cnJlbnQuZnBzRXhwZWN0ZWQpIHtcbiAgICAgICAgLy8gICB0aGlzLmZyYWdDdXJyZW50LmRlY29kZWRGcmFtZXNEYXRlID0gRGF0ZS5ub3coKTtcbiAgICAgICAgLy8gICB0aGlzLmZyYWdDdXJyZW50LmRlY29kZWRGcmFtZXNOYiA9IHRoaXMudmlkZW8ud2Via2l0RGVjb2RlZEZyYW1lQ291bnQ7XG4gICAgICAgIC8vICAgbG9nZ2VyLmxvZyhgZnJhZyBjaGFuZ2VkLCBleHBlY3RlZCBGUFM6JHt0aGlzLmZyYWdDdXJyZW50LmZwc0V4cGVjdGVkLnRvRml4ZWQoMil9YCk7XG4gICAgICAgIC8vIH1cbiAgICAgIH0vKiBlbHNlIHtcbiAgICAgICAgaWYodGhpcy5mcmFnQ3VycmVudC5mcHNFeHBlY3RlZCkge1xuICAgICAgICAgIC8vIGNvbXBhcmUgcmVhbCBmcHMgdnMgdGhlb3JpdGljYWwgb25lXG4gICAgICAgICAgdmFyIG5ibmV3ID0gdGhpcy52aWRlby53ZWJraXREZWNvZGVkRnJhbWVDb3VudDtcbiAgICAgICAgICB2YXIgdGltZSA9IERhdGUubm93KCk7XG4gICAgICAgICAgaWYoKHRpbWUgLSB0aGlzLmZyYWdDdXJyZW50LmRlY29kZWRGcmFtZXNEYXRlKSA+IDIwMDApIHtcbiAgICAgICAgICAgIHZhciBmcHMgPSAxMDAwKihuYm5ldyAtIHRoaXMuZnJhZ0N1cnJlbnQuZGVjb2RlZEZyYW1lc05iKS8odGltZS10aGlzLmZyYWdDdXJyZW50LmRlY29kZWRGcmFtZXNEYXRlKTtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYHJlYWwvZXhwZWN0ZWQgRlBTOiR7ZnBzLnRvRml4ZWQoMil9LyR7dGhpcy5mcmFnQ3VycmVudC5mcHNFeHBlY3RlZC50b0ZpeGVkKDIpfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSAqL1xuICAgIH1cbiAgfVxuXG4vKlxuICBhYm9ydCBhbnkgYnVmZmVyIGFwcGVuZCBpbiBwcm9ncmVzcywgYW5kIGZsdXNoIGFsbCBidWZmZXJlZCBkYXRhXG4gIHJldHVybiB0cnVlIG9uY2UgZXZlcnl0aGluZyBoYXMgYmVlbiBmbHVzaGVkLlxuICBzb3VyY2VCdWZmZXIuYWJvcnQoKSBhbmQgc291cmNlQnVmZmVyLnJlbW92ZSgpIGFyZSBhc3luY2hyb25vdXMgb3BlcmF0aW9uc1xuICB0aGUgaWRlYSBpcyB0byBjYWxsIHRoaXMgZnVuY3Rpb24gZnJvbSB0aWNrKCkgdGltZXIgYW5kIGNhbGwgaXQgYWdhaW4gdW50aWwgYWxsIHJlc291cmNlcyBoYXZlIGJlZW4gY2xlYW5lZFxuICB0aGUgdGltZXIgaXMgcmVhcm1lZCB1cG9uIHNvdXJjZUJ1ZmZlciB1cGRhdGVlbmQoKSBldmVudCwgc28gdGhpcyBzaG91bGQgYmUgb3B0aW1hbFxuKi9cbiAgZmx1c2hCdWZmZXIoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCkge1xuICAgIHZhciBzYixpLGJ1ZlN0YXJ0LGJ1ZkVuZCwgZmx1c2hTdGFydCwgZmx1c2hFbmQ7XG4gICAgLy9sb2dnZXIubG9nKCdmbHVzaEJ1ZmZlcixwb3Mvc3RhcnQvZW5kOiAnICsgdGhpcy52aWRlby5jdXJyZW50VGltZSArICcvJyArIHN0YXJ0T2Zmc2V0ICsgJy8nICsgZW5kT2Zmc2V0KTtcbiAgICAvLyBzYWZlZ3VhcmQgdG8gYXZvaWQgaW5maW5pdGUgbG9vcGluZ1xuICAgIGlmKHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyKysgPCAyKnRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoICYmIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgaWYoIXNiLnVwZGF0aW5nKSB7XG4gICAgICAgICAgZm9yKGkgPSAwIDsgaSA8IHNiLmJ1ZmZlcmVkLmxlbmd0aCA7IGkrKykge1xuICAgICAgICAgICAgYnVmU3RhcnQgPSBzYi5idWZmZXJlZC5zdGFydChpKTtcbiAgICAgICAgICAgIGJ1ZkVuZCA9IHNiLmJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgICAgICAgIC8vIHdvcmthcm91bmQgZmlyZWZveCBub3QgYWJsZSB0byBwcm9wZXJseSBmbHVzaCBtdWx0aXBsZSBidWZmZXJlZCByYW5nZS5cbiAgICAgICAgICAgIGlmKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xICYmICBlbmRPZmZzZXQgPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gc3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gZW5kT2Zmc2V0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IE1hdGgubWF4KGJ1ZlN0YXJ0LHN0YXJ0T2Zmc2V0KTtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBNYXRoLm1pbihidWZFbmQsZW5kT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIHNvbWV0aW1lcyBzb3VyY2VidWZmZXIucmVtb3ZlKCkgZG9lcyBub3QgZmx1c2hcbiAgICAgICAgICAgICAgIHRoZSBleGFjdCBleHBlY3RlZCB0aW1lIHJhbmdlLlxuICAgICAgICAgICAgICAgdG8gYXZvaWQgcm91bmRpbmcgaXNzdWVzL2luZmluaXRlIGxvb3AsXG4gICAgICAgICAgICAgICBvbmx5IGZsdXNoIGJ1ZmZlciByYW5nZSBvZiBsZW5ndGggZ3JlYXRlciB0aGFuIDUwMG1zLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmKGZsdXNoRW5kIC0gZmx1c2hTdGFydCA+IDAuNSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmbHVzaCAke3R5cGV9IFske2ZsdXNoU3RhcnR9LCR7Zmx1c2hFbmR9XSwgb2YgWyR7YnVmU3RhcnR9LCR7YnVmRW5kfV0sIHBvczoke3RoaXMudmlkZW8uY3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHNiLnJlbW92ZShmbHVzaFN0YXJ0LGZsdXNoRW5kKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fib3J0ICcgKyB0eXBlICsgJyBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICAvLyB0aGlzIHdpbGwgYWJvcnQgYW55IGFwcGVuZGluZyBpbiBwcm9ncmVzc1xuICAgICAgICAgIC8vc2IuYWJvcnQoKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKiBhZnRlciBzdWNjZXNzZnVsIGJ1ZmZlciBmbHVzaGluZywgcmVidWlsZCBidWZmZXIgUmFuZ2UgYXJyYXlcbiAgICAgIGxvb3AgdGhyb3VnaCBleGlzdGluZyBidWZmZXIgcmFuZ2UgYW5kIGNoZWNrIGlmXG4gICAgICBjb3JyZXNwb25kaW5nIHJhbmdlIGlzIHN0aWxsIGJ1ZmZlcmVkLiBvbmx5IHB1c2ggdG8gbmV3IGFycmF5IGFscmVhZHkgYnVmZmVyZWQgcmFuZ2VcbiAgICAqL1xuICAgIHZhciBuZXdSYW5nZSA9IFtdLHJhbmdlO1xuICAgIGZvciAoaSA9IDAgOyBpIDwgdGhpcy5idWZmZXJSYW5nZS5sZW5ndGggOyBpKyspIHtcbiAgICAgIHJhbmdlID0gdGhpcy5idWZmZXJSYW5nZVtpXTtcbiAgICAgIGlmKHRoaXMuaXNCdWZmZXJlZCgocmFuZ2Uuc3RhcnQgKyByYW5nZS5lbmQpLzIpKSB7XG4gICAgICAgIG5ld1JhbmdlLnB1c2gocmFuZ2UpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gbmV3UmFuZ2U7XG5cbiAgICBsb2dnZXIubG9nKCdidWZmZXIgZmx1c2hlZCcpO1xuICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZCAhXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAgIC8qXG4gICAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIDpcbiAgICAgICAtIHBhdXNlIHBsYXliYWNrIGlmIHBsYXlpbmdcbiAgICAgICAtIGNhbmNlbCBhbnkgcGVuZGluZyBsb2FkIHJlcXVlc3RcbiAgICAgICAtIGFuZCB0cmlnZ2VyIGEgYnVmZmVyIGZsdXNoXG4gICAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKSB7XG4gICAgaWYoIXRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzbHlQYXVzZWQgPSB0aGlzLnZpZGVvLnBhdXNlZDtcbiAgICAgIHRoaXMudmlkZW8ucGF1c2UoKTtcbiAgICB9XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5hYm9ydCgpO1xuICAgIC8vIGZsdXNoIGV2ZXJ5dGhpbmdcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7IHN0YXJ0IDogMCwgZW5kIDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgLy8gdHJpZ2dlciBhIHNvdXJjZUJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuc3RhdGUgPSBCVUZGRVJfRkxVU0hJTkc7XG4gICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuLypcbiAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggZW5kLCBhZnRlciBuZXcgZnJhZ21lbnQgaGFzIGJlZW4gYnVmZmVyZWQgOlxuICAgIC0gbnVkZ2UgdmlkZW8gZGVjb2RlciBieSBzbGlnaHRseSBhZGp1c3RpbmcgdmlkZW8gY3VycmVudFRpbWVcbiAgICAtIHJlc3VtZSB0aGUgcGxheWJhY2sgaWYgbmVlZGVkXG4qL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpIHtcbiAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IGZhbHNlO1xuICAgIHRoaXMudmlkZW8uY3VycmVudFRpbWUtPTAuMDAwMTtcbiAgICBpZighdGhpcy5wcmV2aW91c2x5UGF1c2VkKSB7XG4gICAgICB0aGlzLnZpZGVvLnBsYXkoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0TGV2ZWxTd2l0Y2goKSB7XG4gICAgLyogdHJ5IHRvIHN3aXRjaCBBU0FQIHdpdGhvdXQgYnJlYWtpbmcgdmlkZW8gcGxheWJhY2sgOlxuICAgICAgIGluIG9yZGVyIHRvIGVuc3VyZSBzbW9vdGggYnV0IHF1aWNrIGxldmVsIHN3aXRjaGluZyxcbiAgICAgIHdlIG5lZWQgdG8gZmluZCB0aGUgbmV4dCBmbHVzaGFibGUgYnVmZmVyIHJhbmdlXG4gICAgICB3ZSBzaG91bGQgdGFrZSBpbnRvIGFjY291bnQgbmV3IHNlZ21lbnQgZmV0Y2ggdGltZVxuICAgICovXG4gICAgdmFyIGZldGNoZGVsYXksY3VycmVudFJhbmdlLG5leHRSYW5nZTtcblxuICAgIGN1cnJlbnRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSk7XG4gICAgaWYoY3VycmVudFJhbmdlKSB7XG4gICAgLy8gZmx1c2ggYnVmZmVyIHByZWNlZGluZyBjdXJyZW50IGZyYWdtZW50IChmbHVzaCB1bnRpbCBjdXJyZW50IGZyYWdtZW50IHN0YXJ0IG9mZnNldClcbiAgICAvLyBtaW51cyAxcyB0byBhdm9pZCB2aWRlbyBmcmVlemluZywgdGhhdCBjb3VsZCBoYXBwZW4gaWYgd2UgZmx1c2gga2V5ZnJhbWUgb2YgY3VycmVudCB2aWRlbyAuLi5cbiAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHsgc3RhcnQgOiAwLCBlbmQgOiBjdXJyZW50UmFuZ2Uuc3RhcnQtMX0pO1xuICAgIH1cblxuICAgIGlmKCF0aGlzLnZpZGVvLnBhdXNlZCkge1xuICAgICAgLy8gYWRkIGEgc2FmZXR5IGRlbGF5IG9mIDFzXG4gICAgICBmZXRjaGRlbGF5PXRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRGZXRjaER1cmF0aW9uKCkrMTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZmV0Y2hkZWxheTonK2ZldGNoZGVsYXkpO1xuICAgIC8vIGZpbmQgYnVmZmVyIHJhbmdlIHRoYXQgd2lsbCBiZSByZWFjaGVkIG9uY2UgbmV3IGZyYWdtZW50IHdpbGwgYmUgZmV0Y2hlZFxuICAgIG5leHRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSArIGZldGNoZGVsYXkpO1xuICAgIGlmKG5leHRSYW5nZSkge1xuICAgICAgLy8gd2UgY2FuIGZsdXNoIGJ1ZmZlciByYW5nZSBmb2xsb3dpbmcgdGhpcyBvbmUgd2l0aG91dCBzdGFsbGluZyBwbGF5YmFja1xuICAgICAgbmV4dFJhbmdlID0gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZShuZXh0UmFuZ2UpO1xuICAgICAgaWYobmV4dFJhbmdlKSB7XG4gICAgICAgIC8vIGZsdXNoIHBvc2l0aW9uIGlzIHRoZSBzdGFydCBwb3NpdGlvbiBvZiB0aGlzIG5ldyBidWZmZXJcbiAgICAgICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goeyBzdGFydCA6IG5leHRSYW5nZS5zdGFydCwgZW5kIDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgIC8vIHRyaWdnZXIgYSBzb3VyY2VCdWZmZXIgZmx1c2hcbiAgICAgIHRoaXMuc3RhdGUgPSBCVUZGRVJfRkxVU0hJTkc7XG4gICAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uTVNFQXR0YWNoZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMudmlkZW8gPSBkYXRhLnZpZGVvO1xuICAgIHRoaXMubWVkaWFTb3VyY2UgPSBkYXRhLm1lZGlhU291cmNlO1xuICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub25WaWRlb1NlZWtpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udnNlZWtlZCA9IHRoaXMub25WaWRlb1NlZWtlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252bWV0YWRhdGEgPSB0aGlzLm9uVmlkZW9NZXRhZGF0YS5iaW5kKHRoaXMpO1xuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsdGhpcy5vbnZzZWVraW5nKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsdGhpcy5vbnZzZWVrZWQpO1xuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLHRoaXMub252bWV0YWRhdGEpO1xuICAgIGlmKHRoaXMubGV2ZWxzKSB7XG4gICAgICB0aGlzLnN0YXJ0KCk7XG4gICAgfVxuICB9XG4gIG9uVmlkZW9TZWVraW5nKCkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IExPQURJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGN1cnJlbnRseSBsb2FkZWQgZnJhZ21lbnQgaXMgaW5zaWRlIGJ1ZmZlci5cbiAgICAgIC8vaWYgb3V0c2lkZSwgY2FuY2VsIGZyYWdtZW50IGxvYWRpbmcsIG90aGVyd2lzZSBkbyBub3RoaW5nXG4gICAgICBpZih0aGlzLmJ1ZmZlckluZm8odGhpcy52aWRlby5jdXJyZW50VGltZSkubGVuID09PSAwKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ3NlZWtpbmcgb3V0c2lkZSBvZiBidWZmZXIgd2hpbGUgZnJhZ21lbnQgbG9hZCBpbiBwcm9ncmVzcywgY2FuY2VsIGZyYWdtZW50IGxvYWQnKTtcbiAgICAgICAgdGhpcy5mcmFnbWVudExvYWRlci5hYm9ydCgpO1xuICAgICAgICB0aGlzLmZyYWcgPSBudWxsO1xuICAgICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lO1xuICAgIH1cbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIHByb2Nlc3NpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uVmlkZW9TZWVrZWQoKSB7XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBGUkFHTUVOVF9QTEFZSU5HIHRyaWdnZXJpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uVmlkZW9NZXRhZGF0YSgpIHtcbiAgICAgIGlmKHRoaXMudmlkZW8uY3VycmVudFRpbWUgIT09IHRoaXMuc3RhcnRQb3NpdGlvbikge1xuICAgICAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgIH1cbiAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gdHJ1ZTtcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMuYXVkaW9jb2RlY3N3aXRjaCA9IGRhdGEuYXVkaW9jb2RlY3N3aXRjaDtcbiAgICBpZih0aGlzLmF1ZGlvY29kZWNzd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBhdWRpbyBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ21lbnRMb2FkZWQgPSBmYWxzZTtcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnN0YXJ0KCk7XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIGZyYWdtZW50cyA9IGRhdGEuZGV0YWlscy5mcmFnbWVudHMsZHVyYXRpb24gPSBkYXRhLmRldGFpbHMudG90YWxkdXJhdGlvbjtcbiAgICBsb2dnZXIubG9nKGBsZXZlbCAke2RhdGEubGV2ZWxJZH0gbG9hZGVkIFske2ZyYWdtZW50c1swXS5zbn0sJHtmcmFnbWVudHNbZnJhZ21lbnRzLmxlbmd0aC0xXS5zbn1dLGR1cmF0aW9uOiR7ZHVyYXRpb259YCk7XG5cbiAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1tkYXRhLmxldmVsSWRdLHNsaWRpbmcgPSAwLCBsZXZlbEN1cnJlbnQgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZCAoaWYgeWVzLCBpdCBzaG91bGQgYmUgYSBsaXZlIHBsYXlsaXN0KVxuICAgIGlmKGxldmVsQ3VycmVudCAmJiBsZXZlbEN1cnJlbnQuZGV0YWlscyAmJiBsZXZlbEN1cnJlbnQuZGV0YWlscy5saXZlKSB7XG4gICAgICB2YXIgb2xkZnJhZ21lbnRzID0gbGV2ZWxDdXJyZW50LmRldGFpbHMuZnJhZ21lbnRzO1xuICAgICAgLy8gIHBsYXlsaXN0IHNsaWRpbmcgaXMgdGhlIHN1bSBvZiA6IGN1cnJlbnQgcGxheWxpc3Qgc2xpZGluZyArIHNsaWRpbmcgb2YgbmV3IHBsYXlsaXN0IGNvbXBhcmVkIHRvIGN1cnJlbnQgb25lXG4gICAgICBzbGlkaW5nID0gbGV2ZWxDdXJyZW50LmRldGFpbHMuc2xpZGluZztcbiAgICAgIC8vIGNoZWNrIHNsaWRpbmcgb2YgdXBkYXRlZCBwbGF5bGlzdCBhZ2FpbnN0IGN1cnJlbnQgb25lIDpcbiAgICAgIC8vIGFuZCBmaW5kIGl0cyBwb3NpdGlvbiBpbiBjdXJyZW50IHBsYXlsaXN0XG4gICAgICAvL2xvZ2dlci5sb2coXCJmcmFnbWVudHNbMF0uc24vdGhpcy5sZXZlbC9sZXZlbEN1cnJlbnQuZGV0YWlscy5mcmFnbWVudHNbMF0uc246XCIgKyBmcmFnbWVudHNbMF0uc24gKyBcIi9cIiArIHRoaXMubGV2ZWwgKyBcIi9cIiArIGxldmVsQ3VycmVudC5kZXRhaWxzLmZyYWdtZW50c1swXS5zbik7XG4gICAgICB2YXIgU05kaWZmID0gZnJhZ21lbnRzWzBdLnNuIC0gb2xkZnJhZ21lbnRzWzBdLnNuO1xuICAgICAgaWYoU05kaWZmID49MCkge1xuICAgICAgICAvLyBwb3NpdGl2ZSBzbGlkaW5nIDogbmV3IHBsYXlsaXN0IHNsaWRpbmcgd2luZG93IGlzIGFmdGVyIHByZXZpb3VzIG9uZVxuICAgICAgICBpZiggU05kaWZmIDwgb2xkZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgIHNsaWRpbmcgKz0gb2xkZnJhZ21lbnRzW1NOZGlmZl0uc3RhcnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgY2Fubm90IGNvbXB1dGUgc2xpZGluZywgbm8gU04gaW4gY29tbW9uIGJldHdlZW4gb2xkOlske29sZGZyYWdtZW50c1swXS5zbn0sJHtvbGRmcmFnbWVudHNbb2xkZnJhZ21lbnRzLmxlbmd0aC0xXS5zbn0vbmV3IGxldmVsIFske2ZyYWdtZW50c1swXS5zbn0sJHtmcmFnbWVudHNbZnJhZ21lbnRzLmxlbmd0aC0xXS5zbn1dYCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG5lZ2F0aXZlIHNsaWRpbmc6IG5ldyBwbGF5bGlzdCBzbGlkaW5nIHdpbmRvdyBpcyBiZWZvcmUgcHJldmlvdXMgb25lXG4gICAgICAgIHNsaWRpbmcgLT0gZnJhZ21lbnRzWy1TTmRpZmZdLnN0YXJ0O1xuICAgICAgfVxuICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCBzbGlkaW5nOiR7c2xpZGluZy50b0ZpeGVkKDMpfWApO1xuICAgIH1cbiAgICAvLyBvdmVycmlkZSBsZXZlbCBpbmZvXG4gICAgbGV2ZWwuZGV0YWlscyA9IGRhdGEuZGV0YWlscztcbiAgICBsZXZlbC5kZXRhaWxzLnNsaWRpbmcgPSBzbGlkaW5nO1xuICAgIHRoaXMuZGVtdXhlci5zZXREdXJhdGlvbihkdXJhdGlvbik7XG4gICAgaWYodGhpcy5zdGFydExldmVsTG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tM1xuICAgICAgaWYoZGF0YS5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCxkdXJhdGlvbiAtIDMgKiBkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgfVxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gb25seSBzd2l0Y2ggYmF0Y2sgdG8gSURMRSBzdGF0ZSBpZiB3ZSB3ZXJlIHdhaXRpbmcgZm9yIGxldmVsIHRvIHN0YXJ0IGRvd25sb2FkaW5nIGEgbmV3IGZyYWdtZW50XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gV0FJVElOR19MRVZFTCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgfVxuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25GcmFnbWVudExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gTE9BRElORykge1xuICAgICAgaWYodGhpcy5mcmFnbWVudEJpdHJhdGVUZXN0ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgLi4uIHdlIGp1c3QgbG9hZGVkIGEgZnJhZ21lbnQgdG8gZGV0ZXJtaW5lIGFkZXF1YXRlIHN0YXJ0IGJpdHJhdGUgYW5kIGluaXRpYWxpemUgYXV0b3N3aXRjaCBhbGdvXG4gICAgICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICAgICAgICB0aGlzLmZyYWdtZW50Qml0cmF0ZVRlc3QgPSBmYWxzZTtcbiAgICAgICAgZGF0YS5zdGF0cy50cGFyc2VkID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgPSBuZXcgRGF0ZSgpO1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHsgc3RhdHMgOiBkYXRhLnN0YXRzLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnN0YXRlID0gUEFSU0lORztcbiAgICAgICAgLy8gdHJhbnNtdXggdGhlIE1QRUctVFMgZGF0YSB0byBJU08tQk1GRiBzZWdtZW50c1xuICAgICAgICB0aGlzLnN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAgICAgdGhpcy5kZW11eGVyLnNldER1cmF0aW9uKHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmRldGFpbHMudG90YWxkdXJhdGlvbik7XG4gICAgICAgIHRoaXMuZGVtdXhlci5wdXNoKGRhdGEucGF5bG9hZCx0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5hdWRpb0NvZGVjLHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWMsdGhpcy5mcmFnLnN0YXJ0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc3RhcnRGcmFnbWVudExvYWRlZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgb25Jbml0U2VnbWVudChldmVudCxkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY29kZWNzIGhhdmUgYmVlbiBleHBsaWNpdGVseSBkZWZpbmVkIGluIHRoZSBtYXN0ZXIgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWw7XG4gICAgLy8gaWYgeWVzIHVzZSB0aGVzZSBvbmVzIGluc3RlYWQgb2YgdGhlIG9uZXMgcGFyc2VkIGZyb20gdGhlIGRlbXV4XG4gICAgdmFyIGF1ZGlvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0udmlkZW9Db2RlYyxzYjtcbiAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGxldmVsIEEvViBjb2RlY3M6JyArIGF1ZGlvQ29kZWMgKyAnLCcgKyB2aWRlb0NvZGVjKTtcbiAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGNvZGVjczonICsgY29kZWMpO1xuICAgIC8vIGlmIHBsYXlsaXN0IGRvZXMgbm90IHNwZWNpZnkgY29kZWNzLCB1c2UgY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnRcbiAgICBpZihhdWRpb0NvZGVjID09PSB1bmRlZmluZWQgfHwgZGF0YS5hdWRpb2NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgfVxuICAgIGlmKHZpZGVvQ29kZWMgPT09IHVuZGVmaW5lZCAgfHwgZGF0YS52aWRlb2NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgfVxuXG4gICAgLy8gY29kZWM9XCJtcDRhLjQwLjUsYXZjMS40MjAwMTZcIjtcbiAgICAvLyBpbiBjYXNlIHNldmVyYWwgYXVkaW8gY29kZWNzIG1pZ2h0IGJlIHVzZWQsIGZvcmNlIEhFLUFBQyBmb3IgYXVkaW8gKHNvbWUgYnJvd3NlcnMgZG9uJ3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2gpXG4gICAgLy9kb24ndCBkbyBpdCBmb3IgbW9ubyBzdHJlYW1zIC4uLlxuICAgIGlmKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCAmJiBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID09PSAyICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhbmRyb2lkJykgPT09IC0xICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgfVxuICAgIGlmKCF0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSB7fTtcbiAgICAgIGxvZ2dlci5sb2coYHNlbGVjdGVkIEEvViBjb2RlY3MgZm9yIHNvdXJjZUJ1ZmZlcnM6JHthdWRpb0NvZGVjfSwke3ZpZGVvQ29kZWN9YCk7XG4gICAgICAvLyBjcmVhdGUgc291cmNlIEJ1ZmZlciBhbmQgbGluayB0aGVtIHRvIE1lZGlhU291cmNlXG4gICAgICBpZihhdWRpb0NvZGVjKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8gPSB0aGlzLm1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcihgdmlkZW8vbXA0O2NvZGVjcz0ke2F1ZGlvQ29kZWN9YCk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgIH1cbiAgICAgIGlmKHZpZGVvQ29kZWMpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlci52aWRlbyA9IHRoaXMubWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKGB2aWRlby9tcDQ7Y29kZWNzPSR7dmlkZW9Db2RlY31gKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihhdWRpb0NvZGVjKSB7XG4gICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogJ2F1ZGlvJywgZGF0YSA6IGRhdGEuYXVkaW9Nb292fSk7XG4gICAgfVxuICAgIGlmKHZpZGVvQ29kZWMpIHtcbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiAndmlkZW8nLCBkYXRhIDogZGF0YS52aWRlb01vb3Z9KTtcbiAgICB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkZyYWdtZW50UGFyc2luZyhldmVudCxkYXRhKSB7XG4gICAgdGhpcy50cGFyc2UyID0gRGF0ZS5ub3coKTtcbiAgICBsb2dnZXIubG9nKGAgICAgICBwYXJzZWQgZGF0YSwgdHlwZS9zdGFydFBUUy9lbmRQVFMvc3RhcnREVFMvZW5kRFRTL25iOiR7ZGF0YS50eXBlfS8ke2RhdGEuc3RhcnRQVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZFBUUy50b0ZpeGVkKDMpfS8ke2RhdGEuc3RhcnREVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZERUUy50b0ZpeGVkKDMpfS8ke2RhdGEubmJ9YCk7XG4gICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6IGRhdGEudHlwZSwgZGF0YSA6IGRhdGEubW9vZn0pO1xuICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiBkYXRhLnR5cGUsIGRhdGEgOiBkYXRhLm1kYXR9KTtcbiAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSBkYXRhLmVuZFBUUztcbiAgICB0aGlzLmJ1ZmZlclJhbmdlLnB1c2goe3R5cGUgOiBkYXRhLnR5cGUsIHN0YXJ0IDogZGF0YS5zdGFydFBUUywgZW5kIDogZGF0YS5lbmRQVFMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAvLyBpZihkYXRhLnR5cGUgPT09ICd2aWRlbycpIHtcbiAgICAvLyAgIHRoaXMuZnJhZy5mcHNFeHBlY3RlZCA9IChkYXRhLm5iLTEpIC8gKGRhdGEuZW5kUFRTIC0gZGF0YS5zdGFydFBUUyk7XG4gICAgLy8gfVxuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25GcmFnbWVudFBhcnNlZCgpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBQQVJTRUQ7XG4gICAgICB0aGlzLnN0YXRzLnRwYXJzZWQgPSBuZXcgRGF0ZSgpO1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25GcmFnbWVudExvYWRFcnJvcigpIHtcbiAgICBsb2dnZXIubG9nKCdidWZmZXIgY29udHJvbGxlcjogZXJyb3Igd2hpbGUgbG9hZGluZyBmcmFnLCByZXRyeSAuLi4nKTtcbiAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICB0aGlzLmZyYWcgPSBudWxsO1xuICB9XG5cbiAgb25GcmFnbWVudExvYWRUaW1lb3V0KCkge1xuICAgIGxvZ2dlci5sb2coJ2J1ZmZlciBjb250cm9sbGVyOiB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgZnJhZywgcmV0cnkgLi4uJyk7XG4gICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgfVxuXG4gIG9uU291cmNlQnVmZmVyVXBkYXRlRW5kKCkge1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IEFQUEVORElORyAmJiB0aGlzLm1wNHNlZ21lbnRzLmxlbmd0aCA9PT0gMCkgIHtcbiAgICAgIHRoaXMuc3RhdHMudGJ1ZmZlcmVkID0gbmV3IERhdGUoKTtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwgeyBzdGF0cyA6IHRoaXMuc3RhdHMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICAgIH1cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uU291cmNlQnVmZmVyRXJyb3IoZXZlbnQpIHtcbiAgICAgIGxvZ2dlci5sb2coYHNvdXJjZUJ1ZmZlciBlcnJvcjoke2V2ZW50fWApO1xuICAgICAgdGhpcy5zdGF0ZSA9IEVSUk9SO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0FQUEVORElOR19FUlJPUiwge2ZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCdWZmZXJDb250cm9sbGVyO1xuIiwiLypcbiAqIGxldmVsIGNvbnRyb2xsZXJcbiAqXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4gaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cblxuIGNsYXNzIExldmVsQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IocGxheWxpc3RMb2FkZXIpIHtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gcGxheWxpc3RMb2FkZXI7XG4gICAgdGhpcy5vbm1sID0gdGhpcy5vbk1hbmlmZXN0TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdtZW50TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsZSA9IHRoaXMub25GcmFnbWVudExvYWRFcnJvci5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbHQgPSB0aGlzLm9uRnJhZ21lbnRMb2FkVGltZW91dC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTUFOSUZFU1RfTE9BREVELCB0aGlzLm9ubWwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfTE9BRF9FUlJPUiwgdGhpcy5vbmZsZSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FEX1RJTUVPVVQsIHRoaXMub25mbHQpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgICAvL3RoaXMuc3RhcnRMZXZlbCA9IHN0YXJ0TGV2ZWw7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX0xPQURfRVJST1IsIHRoaXMub25mbGUpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkZSQUdfTE9BRF9USU1FT1VULCB0aGlzLm9uZmx0KTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgaWYodGhpcy50aW1lcikge1xuICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIH1cbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IC0xO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIGxldmVscyA9IFtdLGJpdHJhdGVTdGFydCxpLGJpdHJhdGVTZXQ9e30sIGFhYz1mYWxzZSwgaGVhYWM9ZmFsc2UsY29kZWNzO1xuICAgIGlmKGRhdGEubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgIC8vIHJlbW92ZSBmYWlsb3ZlciBsZXZlbCBmb3Igbm93IHRvIHNpbXBsaWZ5IHRoZSBsb2dpY1xuICAgICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAgIGlmKCFiaXRyYXRlU2V0Lmhhc093blByb3BlcnR5KGxldmVsLmJpdHJhdGUpKSB7XG4gICAgICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVjdCBpZiB3ZSBoYXZlIGRpZmZlcmVudCBraW5kIG9mIGF1ZGlvIGNvZGVjcyB1c2VkIGFtb25nc3QgcGxheWxpc3RzXG4gICAgICAgIGNvZGVjcyA9IGxldmVsLmNvZGVjcztcbiAgICAgICAgaWYoY29kZWNzKSB7XG4gICAgICAgICAgaWYoY29kZWNzLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSkge1xuICAgICAgICAgICAgYWFjID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoY29kZWNzLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkge1xuICAgICAgICAgICAgaGVhYWMgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICAvLyBzdGFydCBiaXRyYXRlIGlzIHRoZSBmaXJzdCBiaXRyYXRlIG9mIHRoZSBtYW5pZmVzdFxuICAgICAgYml0cmF0ZVN0YXJ0ID0gbGV2ZWxzWzBdLmJpdHJhdGU7XG4gICAgICAvLyBzb3J0IGxldmVsIG9uIGJpdHJhdGVcbiAgICAgIGxldmVscy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLmJpdHJhdGUtYi5iaXRyYXRlO1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG5cbiAgICAgIC8vIGZpbmQgaW5kZXggb2YgZmlyc3QgbGV2ZWwgaW4gc29ydGVkIGxldmVsc1xuICAgICAgZm9yKGk9MDsgaSA8IGxldmVscy5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgaWYobGV2ZWxzW2ldLmJpdHJhdGUgPT09IGJpdHJhdGVTdGFydCkge1xuICAgICAgICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBpO1xuICAgICAgICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGxvYWRlZCwke2xldmVscy5sZW5ndGh9IGxldmVsKHMpIGZvdW5kLCBmaXJzdCBiaXRyYXRlOiR7Yml0cmF0ZVN0YXJ0fWApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vdGhpcy5fc3RhcnRMZXZlbCA9IC0xO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiB0aGlzLl9sZXZlbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydExldmVsIDogdGhpcy5fc3RhcnRMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvY29kZWNzd2l0Y2ggOiAoYWFjICYmIGhlYWFjKVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2xldmVscyA9IGRhdGEubGV2ZWxzO1xuICAgICAgdGhpcy5fZmlyc3RMZXZlbCA9IDA7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCxcbiAgICAgICAgICAgICAgICAgICAgICB7IGxldmVscyA6IHRoaXMuX2xldmVscyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0TGV2ZWwgOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXVkaW9jb2RlY3N3aXRjaCA6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWxzO1xuICB9XG5cbiAgZ2V0IGxldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbDtcbiAgfVxuXG4gIHNldCBsZXZlbChuZXdMZXZlbCkge1xuICAgIGlmKHRoaXMuX2xldmVsICE9PSBuZXdMZXZlbCkge1xuICAgICAgLy8gY2hlY2sgaWYgbGV2ZWwgaWR4IGlzIHZhbGlkXG4gICAgICBpZihuZXdMZXZlbCA+PSAwICYmIG5ld0xldmVsIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aCkge1xuICAgICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgICAgaWYodGhpcy50aW1lcikge1xuICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2xldmVsID0gbmV3TGV2ZWw7XG4gICAgICAgIGxvZ2dlci5sb2coYHN3aXRjaGluZyB0byBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX1NXSVRDSCwgeyBsZXZlbElkIDogbmV3TGV2ZWx9KTtcbiAgICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW25ld0xldmVsXTtcbiAgICAgICAgIC8vIGNoZWNrIGlmIHdlIG5lZWQgdG8gbG9hZCBwbGF5bGlzdCBmb3IgdGhpcyBsZXZlbFxuICAgICAgICBpZihsZXZlbC5sb2FkaW5nID09PSB1bmRlZmluZWQgfHwgKGxldmVsLmRldGFpbHMgJiYgbGV2ZWwuZGV0YWlscy5saXZlID09PSB0cnVlKSkge1xuICAgICAgICAgIC8vIGxldmVsIG5vdCByZXRyaWV2ZWQgeWV0LCBvciBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gKHJlKWxvYWQgaXRcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHsgbGV2ZWxJZCA6IG5ld0xldmVsfSk7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgKHJlKWxvYWRpbmcgcGxheWxpc3QgZm9yIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICAgICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKGxldmVsLnVybCxuZXdMZXZlbCk7XG4gICAgICAgICAgbGV2ZWwubG9hZGluZyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGludmFsaWQgbGV2ZWwgaWQgZ2l2ZW4sIHRyaWdnZXIgZXJyb3JcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9FUlJPUiwgeyBsZXZlbCA6IG5ld0xldmVsLCBldmVudDogJ2ludmFsaWQgbGV2ZWwgaWR4J30pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gIH1cblxuICBzZXQgbWFudWFsTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMubGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gIH1cblxuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIGlmKHRoaXMuX3N0YXJ0TGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGFydExldmVsO1xuICAgIH1cbiAgfVxuXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgb25GcmFnbWVudExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gKHN0YXRzLnRsb2FkIC0gc3RhdHMudHJlcXVlc3QpLzEwMDA7XG4gICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICB0aGlzLmxhc3RidyA9IHN0YXRzLmxlbmd0aCo4L3RoaXMubGFzdGZldGNoZHVyYXRpb247XG4gICAgLy9jb25zb2xlLmxvZyhgbGVuOiR7c3RhdHMubGVuZ3RofSxmZXRjaER1cmF0aW9uOiR7dGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbn0sYnc6JHsodGhpcy5sYXN0YncvMTAwMCkudG9GaXhlZCgwKX1gKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkRXJyb3IoKSB7XG4gICAgbG9nZ2VyLmxvZyhgbGV2ZWwgY29udHJvbGxlcixmcmFnIGxvYWQgZXJyb3I6IGVtZXJnZW5jeSBzd2l0Y2gtZG93biBmb3IgbmV4dCBmcmFnbWVudGApO1xuICAgIHRoaXMubGFzdGJ3ID0gMDtcbiAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gMDtcblxuICB9XG5cbiAgb25GcmFnbWVudExvYWRUaW1lb3V0KCkge1xuICAgIGxvZ2dlci5sb2coYGxldmVsIGNvbnRyb2xsZXIsZnJhZyBsb2FkIHRpbWVvdXQ6IGVtZXJnZW5jeSBzd2l0Y2gtZG93biBmb3IgbmV4dCBmcmFnbWVudGApO1xuICAgIHRoaXMubGFzdGJ3ID0gMDtcbiAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gMDtcbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgcGxheWxpc3QgaXMgYSBsaXZlIHBsYXlsaXN0XG4gICAgaWYoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwKmRhdGEuZGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgdGljaygpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHsgbGV2ZWxJZCA6IHRoaXMuX2xldmVsfSk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKHRoaXMuX2xldmVsc1t0aGlzLl9sZXZlbF0udXJsLHRoaXMuX2xldmVsKTtcbiAgfVxuXG4gIG5leHRMZXZlbCgpIHtcbiAgICBpZih0aGlzLl9tYW51YWxMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICByZXR1cm4gdGhpcy5uZXh0QXV0b0xldmVsKCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dEZldGNoRHVyYXRpb24oKSB7XG4gICAgaWYodGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMubGFzdGZldGNoZHVyYXRpb24qdGhpcy5fbGV2ZWxzW3RoaXMuX2xldmVsXS5iaXRyYXRlL3RoaXMuX2xldmVsc1t0aGlzLmxhc3RmZXRjaGxldmVsXS5iaXRyYXRlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gIH1cblxuICBuZXh0QXV0b0xldmVsKCkge1xuICAgIHZhciBsYXN0YncgPSB0aGlzLmxhc3RidyxhZGp1c3RlZGJ3LGksbWF4QXV0b0xldmVsO1xuICAgIGlmKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9sZXZlbHMubGVuZ3RoLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IoaSA9MDsgaSA8PSBtYXhBdXRvTGV2ZWwgOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmKGkgPD0gdGhpcy5fbGV2ZWwpIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuOCpsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43Kmxhc3RidztcbiAgICAgIH1cbiAgICAgIGlmKGFkanVzdGVkYncgPCB0aGlzLl9sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCxpLTEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaS0xO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcbiIsIiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyICAgICAgICAgICAgZnJvbSAnLi90c2RlbXV4ZXInO1xuIGltcG9ydCBUU0RlbXV4ZXJXb3JrZXIgICAgICBmcm9tICcuL3RzZGVtdXhlcndvcmtlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcbiAgICBpZihjb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ1RTIGRlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoVFNEZW11eGVyV29ya2VyKTtcbiAgICAgICAgICB0aGlzLm9ud21zZyA9IHRoaXMub25Xb3JrZXJNZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgICAgICAgdGhpcy53LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ2luaXQnfSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnZXJyb3Igd2hpbGUgaW5pdGlhbGl6aW5nIFRTRGVtdXhlcldvcmtlciwgZmFsbGJhY2sgb24gcmVndWxhciBUU0RlbXV4ZXInKTtcbiAgICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBzZXREdXJhdGlvbihuZXdEdXJhdGlvbikge1xuICAgIGlmKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ2R1cmF0aW9uJyAsIGRhdGEgOiBuZXdEdXJhdGlvbn0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuc2V0RHVyYXRpb24obmV3RHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICB0aGlzLncucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQpIHtcbiAgICBpZih0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdkZW11eCcgLCBkYXRhIDogZGF0YSwgYXVkaW9Db2RlYyA6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQgOiB0aW1lT2Zmc2V0fSxbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCk7XG4gICAgICB0aGlzLmRlbXV4ZXIuZW5kKCk7XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2UoeyBjbWQgOiAnc3dpdGNoTGV2ZWwnfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZXYuZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGV2LmRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBpZihldi5kYXRhLmF1ZGlvTW9vdikge1xuICAgICAgICAgIG9iai5hdWRpb01vb3YgPSBuZXcgVWludDhBcnJheShldi5kYXRhLmF1ZGlvTW9vdik7XG4gICAgICAgICAgb2JqLmF1ZGlvQ29kZWMgPSBldi5kYXRhLmF1ZGlvQ29kZWM7XG4gICAgICAgICAgb2JqLmF1ZGlvQ2hhbm5lbENvdW50ID0gZXYuZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGV2LmRhdGEudmlkZW9Nb292KSB7XG4gICAgICAgICAgb2JqLnZpZGVvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEudmlkZW9Nb292KTtcbiAgICAgICAgICBvYmoudmlkZW9Db2RlYyA9IGV2LmRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgICBvYmoudmlkZW9XaWR0aCA9IGV2LmRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgICBvYmoudmlkZW9IZWlnaHQgPSBldi5kYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfREFUQTpcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICAgICAgbW9vZiA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubW9vZiksXG4gICAgICAgICAgbWRhdCA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubWRhdCksXG4gICAgICAgICAgc3RhcnRQVFMgOiBldi5kYXRhLnN0YXJ0UFRTLFxuICAgICAgICAgIGVuZFBUUyA6IGV2LmRhdGEuZW5kUFRTLFxuICAgICAgICAgIHN0YXJ0RFRTIDogZXYuZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFMgOiBldi5kYXRhLmVuZERUUyxcbiAgICAgICAgICB0eXBlIDogZXYuZGF0YS50eXBlLFxuICAgICAgICAgIG5iIDogZXYuZGF0YS5uYlxuICAgICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNFRDpcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNFRCk7XG4gICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXI7XG4iLCIvKipcbiAqIFBhcnNlciBmb3IgZXhwb25lbnRpYWwgR29sb21iIGNvZGVzLCBhIHZhcmlhYmxlLWJpdHdpZHRoIG51bWJlciBlbmNvZGluZ1xuICogc2NoZW1lIHVzZWQgYnkgaDI2NC5cbiAqL1xuXG5pbXBvcnQge2xvZ2dlcn0gICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV4cEdvbG9tYiB7XG5cbiAgY29uc3RydWN0b3Iod29ya2luZ0RhdGEpIHtcbiAgICB0aGlzLndvcmtpbmdEYXRhID0gd29ya2luZ0RhdGE7XG4gICAgLy8gdGhlIG51bWJlciBvZiBieXRlcyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhpcy53b3JraW5nRGF0YVxuICAgIHRoaXMud29ya2luZ0J5dGVzQXZhaWxhYmxlID0gdGhpcy53b3JraW5nRGF0YS5ieXRlTGVuZ3RoO1xuICAgIC8vIHRoZSBjdXJyZW50IHdvcmQgYmVpbmcgZXhhbWluZWRcbiAgICB0aGlzLndvcmtpbmdXb3JkID0gMDsgLy8gOnVpbnRcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJpdHMgbGVmdCB0byBleGFtaW5lIGluIHRoZSBjdXJyZW50IHdvcmRcbiAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlID0gMDsgLy8gOnVpbnRcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgbG9hZFdvcmQoKSB7XG4gICAgdmFyXG4gICAgICBwb3NpdGlvbiA9IHRoaXMud29ya2luZ0RhdGEuYnl0ZUxlbmd0aCAtIHRoaXMud29ya2luZ0J5dGVzQXZhaWxhYmxlLFxuICAgICAgd29ya2luZ0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCksXG4gICAgICBhdmFpbGFibGVCeXRlcyA9IE1hdGgubWluKDQsIHRoaXMud29ya2luZ0J5dGVzQXZhaWxhYmxlKTtcblxuICAgIGlmIChhdmFpbGFibGVCeXRlcyA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdubyBieXRlcyBhdmFpbGFibGUnKTtcbiAgICB9XG5cbiAgICB3b3JraW5nQnl0ZXMuc2V0KHRoaXMud29ya2luZ0RhdGEuc3ViYXJyYXkocG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbiArIGF2YWlsYWJsZUJ5dGVzKSk7XG4gICAgdGhpcy53b3JraW5nV29yZCA9IG5ldyBEYXRhVmlldyh3b3JraW5nQnl0ZXMuYnVmZmVyKS5nZXRVaW50MzIoMCk7XG5cbiAgICAvLyB0cmFjayB0aGUgYW1vdW50IG9mIHRoaXMud29ya2luZ0RhdGEgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWRcbiAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlID0gYXZhaWxhYmxlQnl0ZXMgKiA4O1xuICAgIHRoaXMud29ya2luZ0J5dGVzQXZhaWxhYmxlIC09IGF2YWlsYWJsZUJ5dGVzO1xuICB9XG5cbiAgLy8gKGNvdW50OmludCk6dm9pZFxuICBza2lwQml0cyhjb3VudCkge1xuICAgIHZhciBza2lwQnl0ZXM7IC8vIDppbnRcbiAgICBpZiAodGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA+IGNvdW50KSB7XG4gICAgICB0aGlzLndvcmtpbmdXb3JkICAgICAgICAgIDw8PSBjb3VudDtcbiAgICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvdW50IC09IHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGU7XG4gICAgICBza2lwQnl0ZXMgPSBjb3VudCA+PiAzO1xuXG4gICAgICBjb3VudCAtPSAoc2tpcEJ5dGVzID4+IDMpO1xuICAgICAgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgLT0gc2tpcEJ5dGVzO1xuXG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG5cbiAgICAgIHRoaXMud29ya2luZ1dvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9XG4gIH1cblxuICAvLyAoc2l6ZTppbnQpOnVpbnRcbiAgcmVhZEJpdHMoc2l6ZSkge1xuICAgIHZhclxuICAgICAgYml0cyA9IE1hdGgubWluKHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUsIHNpemUpLCAvLyA6dWludFxuICAgICAgdmFsdSA9IHRoaXMud29ya2luZ1dvcmQgPj4+ICgzMiAtIGJpdHMpOyAvLyA6dWludFxuXG4gICAgaWYoc2l6ZSA+MzIpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignQ2Fubm90IHJlYWQgbW9yZSB0aGFuIDMyIGJpdHMgYXQgYSB0aW1lJyk7XG4gICAgfVxuXG4gICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSAtPSBiaXRzO1xuICAgIGlmICh0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy53b3JraW5nV29yZCA8PD0gYml0cztcbiAgICB9IGVsc2UgaWYgKHRoaXMud29ya2luZ0J5dGVzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIH1cblxuICAgIGJpdHMgPSBzaXplIC0gYml0cztcbiAgICBpZiAoYml0cyA+IDApIHtcbiAgICAgIHJldHVybiB2YWx1IDw8IGJpdHMgfCB0aGlzLnJlYWRCaXRzKGJpdHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdmFsdTtcbiAgICB9XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHNraXBMZWFkaW5nWmVyb3MoKSB7XG4gICAgdmFyIGxlYWRpbmdaZXJvQ291bnQ7IC8vIDp1aW50XG4gICAgZm9yIChsZWFkaW5nWmVyb0NvdW50ID0gMCA7IGxlYWRpbmdaZXJvQ291bnQgPCB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIDsgKytsZWFkaW5nWmVyb0NvdW50KSB7XG4gICAgICBpZiAoMCAhPT0gKHRoaXMud29ya2luZ1dvcmQgJiAoMHg4MDAwMDAwMCA+Pj4gbGVhZGluZ1plcm9Db3VudCkpKSB7XG4gICAgICAgIC8vIHRoZSBmaXJzdCBiaXQgb2Ygd29ya2luZyB3b3JkIGlzIDFcbiAgICAgICAgdGhpcy53b3JraW5nV29yZCA8PD0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSAtPSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3ZSBleGhhdXN0ZWQgd29ya2luZ1dvcmQgYW5kIHN0aWxsIGhhdmUgbm90IGZvdW5kIGEgMVxuICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudCArIHRoaXMuc2tpcExlYWRpbmdaZXJvcygpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwVW5zaWduZWRFeHBHb2xvbWIoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCkpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwRXhwR29sb21iKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExlYWRpbmdaZXJvcygpKTtcbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgcmVhZFVuc2lnbmVkRXhwR29sb21iKCkge1xuICAgIHZhciBjbHogPSB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKTsgLy8gOnVpbnRcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyhjbHogKyAxKSAtIDE7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZEV4cEdvbG9tYigpIHtcbiAgICB2YXIgdmFsdSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIDppbnRcbiAgICBpZiAoMHgwMSAmIHZhbHUpIHtcbiAgICAgIC8vIHRoZSBudW1iZXIgaXMgb2RkIGlmIHRoZSBsb3cgb3JkZXIgYml0IGlzIHNldFxuICAgICAgcmV0dXJuICgxICsgdmFsdSkgPj4+IDE7IC8vIGFkZCAxIHRvIG1ha2UgaXQgZXZlbiwgYW5kIGRpdmlkZSBieSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMSAqICh2YWx1ID4+PiAxKTsgLy8gZGl2aWRlIGJ5IHR3byB0aGVuIG1ha2UgaXQgbmVnYXRpdmVcbiAgICB9XG4gIH1cblxuICAvLyBTb21lIGNvbnZlbmllbmNlIGZ1bmN0aW9uc1xuICAvLyA6Qm9vbGVhblxuICByZWFkQm9vbGVhbigpIHtcbiAgICByZXR1cm4gMSA9PT0gdGhpcy5yZWFkQml0cygxKTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkVW5zaWduZWRCeXRlKCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIEV4cEdvbG9tYiBkZWNvZGVyIHBhc3QgYSBzY2FsaW5nIGxpc3QuIFRoZSBzY2FsaW5nXG4gICAqIGxpc3QgaXMgb3B0aW9uYWxseSB0cmFuc21pdHRlZCBhcyBwYXJ0IG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyXG4gICAqIHNldCBhbmQgaXMgbm90IHJlbGV2YW50IHRvIHRyYW5zbXV4aW5nLlxuICAgKiBAcGFyYW0gY291bnQge251bWJlcn0gdGhlIG51bWJlciBvZiBlbnRyaWVzIGluIHRoaXMgc2NhbGluZyBsaXN0XG4gICAqIEBzZWUgUmVjb21tZW5kYXRpb24gSVRVLVQgSC4yNjQsIFNlY3Rpb24gNy4zLjIuMS4xLjFcbiAgICovXG4gIHNraXBTY2FsaW5nTGlzdChjb3VudCkge1xuICAgIHZhclxuICAgICAgbGFzdFNjYWxlID0gOCxcbiAgICAgIG5leHRTY2FsZSA9IDgsXG4gICAgICBqLFxuICAgICAgZGVsdGFTY2FsZTtcblxuICAgIGZvciAoaiA9IDA7IGogPCBjb3VudDsgaisrKSB7XG4gICAgICBpZiAobmV4dFNjYWxlICE9PSAwKSB7XG4gICAgICAgIGRlbHRhU2NhbGUgPSB0aGlzLnJlYWRFeHBHb2xvbWIoKTtcbiAgICAgICAgbmV4dFNjYWxlID0gKGxhc3RTY2FsZSArIGRlbHRhU2NhbGUgKyAyNTYpICUgMjU2O1xuICAgICAgfVxuXG4gICAgICBsYXN0U2NhbGUgPSAobmV4dFNjYWxlID09PSAwKSA/IGxhc3RTY2FsZSA6IG5leHRTY2FsZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVhZCBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgYW5kIHJldHVybiBzb21lIGludGVyZXN0aW5nIHZpZGVvXG4gICAqIHByb3BlcnRpZXMuIEEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBpcyB0aGUgSDI2NCBtZXRhZGF0YSB0aGF0XG4gICAqIGRlc2NyaWJlcyB0aGUgcHJvcGVydGllcyBvZiB1cGNvbWluZyB2aWRlbyBmcmFtZXMuXG4gICAqIEBwYXJhbSBkYXRhIHtVaW50OEFycmF5fSB0aGUgYnl0ZXMgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0XG4gICAqIEByZXR1cm4ge29iamVjdH0gYW4gb2JqZWN0IHdpdGggY29uZmlndXJhdGlvbiBwYXJzZWQgZnJvbSB0aGVcbiAgICogc2VxdWVuY2UgcGFyYW1ldGVyIHNldCwgaW5jbHVkaW5nIHRoZSBkaW1lbnNpb25zIG9mIHRoZVxuICAgKiBhc3NvY2lhdGVkIHZpZGVvIGZyYW1lcy5cbiAgICovXG4gIHJlYWRTZXF1ZW5jZVBhcmFtZXRlclNldCgpIHtcbiAgICB2YXJcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IDAsXG4gICAgICBwcm9maWxlSWRjLHByb2ZpbGVDb21wYXRpYmlsaXR5LGxldmVsSWRjLFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlLCBwaWNXaWR0aEluTWJzTWludXMxLFxuICAgICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSxcbiAgICAgIGZyYW1lTWJzT25seUZsYWcsXG4gICAgICBzY2FsaW5nTGlzdENvdW50LFxuICAgICAgaTtcblxuICAgIHRoaXMucmVhZFVuc2lnbmVkQnl0ZSgpO1xuICAgIHByb2ZpbGVJZGMgPSB0aGlzLnJlYWRVbnNpZ25lZEJ5dGUoKTsgLy8gcHJvZmlsZV9pZGNcbiAgICBwcm9maWxlQ29tcGF0aWJpbGl0eSA9IHRoaXMucmVhZEJpdHMoNSk7IC8vIGNvbnN0cmFpbnRfc2V0WzAtNF1fZmxhZywgdSg1KVxuICAgIHRoaXMuc2tpcEJpdHMoMyk7IC8vIHJlc2VydmVkX3plcm9fM2JpdHMgdSgzKSxcbiAgICBsZXZlbElkYyA9IHRoaXMucmVhZFVuc2lnbmVkQnl0ZSgpOyAvL2xldmVsX2lkYyB1KDgpXG4gICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gc2VxX3BhcmFtZXRlcl9zZXRfaWRcblxuICAgIC8vIHNvbWUgcHJvZmlsZXMgaGF2ZSBtb3JlIG9wdGlvbmFsIGRhdGEgd2UgZG9uJ3QgbmVlZFxuICAgIGlmIChwcm9maWxlSWRjID09PSAxMDAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTEwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyMiB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxNDQpIHtcbiAgICAgIHZhciBjaHJvbWFGb3JtYXRJZGMgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgaWYgKGNocm9tYUZvcm1hdElkYyA9PT0gMykge1xuICAgICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBzZXBhcmF0ZV9jb2xvdXJfcGxhbmVfZmxhZ1xuICAgICAgfVxuICAgICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gYml0X2RlcHRoX2x1bWFfbWludXM4XG4gICAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBiaXRfZGVwdGhfY2hyb21hX21pbnVzOFxuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gcXBwcmltZV95X3plcm9fdHJhbnNmb3JtX2J5cGFzc19mbGFnXG4gICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX21hdHJpeF9wcmVzZW50X2ZsYWdcbiAgICAgICAgc2NhbGluZ0xpc3RDb3VudCA9IChjaHJvbWFGb3JtYXRJZGMgIT09IDMpID8gOCA6IDEyO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc2NhbGluZ0xpc3RDb3VudDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19saXN0X3ByZXNlbnRfZmxhZ1sgaSBdXG4gICAgICAgICAgICBpZiAoaSA8IDYpIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoMTYpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoNjQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIGxvZzJfbWF4X2ZyYW1lX251bV9taW51czRcbiAgICB2YXIgcGljT3JkZXJDbnRUeXBlID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcblxuICAgIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDApIHtcbiAgICAgIHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7IC8vbG9nMl9tYXhfcGljX29yZGVyX2NudF9sc2JfbWludXM0XG4gICAgfSBlbHNlIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDEpIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRlbHRhX3BpY19vcmRlcl9hbHdheXNfemVyb19mbGFnXG4gICAgICB0aGlzLnNraXBFeHBHb2xvbWIoKTsgLy8gb2Zmc2V0X2Zvcl9ub25fcmVmX3BpY1xuICAgICAgdGhpcy5za2lwRXhwR29sb21iKCk7IC8vIG9mZnNldF9mb3JfdG9wX3RvX2JvdHRvbV9maWVsZFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZvcihpID0gMDsgaSA8IG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZTsgaSsrKSB7XG4gICAgICAgIHRoaXMuc2tpcEV4cEdvbG9tYigpOyAvLyBvZmZzZXRfZm9yX3JlZl9mcmFtZVsgaSBdXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gbWF4X251bV9yZWZfZnJhbWVzXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZ2Fwc19pbl9mcmFtZV9udW1fdmFsdWVfYWxsb3dlZF9mbGFnXG5cbiAgICBwaWNXaWR0aEluTWJzTWludXMxID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcblxuICAgIGZyYW1lTWJzT25seUZsYWcgPSB0aGlzLnJlYWRCaXRzKDEpO1xuICAgIGlmIChmcmFtZU1ic09ubHlGbGFnID09PSAwKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBtYl9hZGFwdGl2ZV9mcmFtZV9maWVsZF9mbGFnXG4gICAgfVxuXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGlyZWN0Xzh4OF9pbmZlcmVuY2VfZmxhZ1xuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gZnJhbWVfY3JvcHBpbmdfZmxhZ1xuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgcHJvZmlsZUlkYyA6IHByb2ZpbGVJZGMsXG4gICAgICBwcm9maWxlQ29tcGF0aWJpbGl0eSA6IHByb2ZpbGVDb21wYXRpYmlsaXR5LFxuICAgICAgbGV2ZWxJZGMgOiBsZXZlbElkYyxcbiAgICAgIHdpZHRoOiAoKHBpY1dpZHRoSW5NYnNNaW51czEgKyAxKSAqIDE2KSAtIGZyYW1lQ3JvcExlZnRPZmZzZXQgKiAyIC0gZnJhbWVDcm9wUmlnaHRPZmZzZXQgKiAyLFxuICAgICAgaGVpZ2h0OiAoKDIgLSBmcmFtZU1ic09ubHlGbGFnKSAqIChwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxICsgMSkgKiAxNikgLSAoZnJhbWVDcm9wVG9wT2Zmc2V0ICogMikgLSAoZnJhbWVDcm9wQm90dG9tT2Zmc2V0ICogMilcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEV4cEdvbG9tYjtcbiIsIi8qKlxuICogQSBzdHJlYW0tYmFzZWQgbXAydHMgdG8gbXA0IGNvbnZlcnRlci4gVGhpcyB1dGlsaXR5IGlzIHVzZWQgdG9cbiAqIGRlbGl2ZXIgbXA0cyB0byBhIFNvdXJjZUJ1ZmZlciBvbiBwbGF0Zm9ybXMgdGhhdCBzdXBwb3J0IG5hdGl2ZVxuICogTWVkaWEgU291cmNlIEV4dGVuc2lvbnMuXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXhwR29sb21iICAgICAgIGZyb20gJy4vZXhwLWdvbG9tYic7XG4vLyBpbXBvcnQgSGV4ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2hleCc7XG4gaW1wb3J0IE1QNCAgICAgICAgICAgICBmcm9tICcuLi9yZW11eC9tcDQtZ2VuZXJhdG9yJztcbi8vIGltcG9ydCBNUDRJbnNwZWN0ICAgICAgZnJvbSAnLi4vcmVtdXgvbXA0LWluc3BlY3Rvcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4gaW1wb3J0IHtsb2dnZXJ9ICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4gY2xhc3MgVFNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gIH1cblxuICBzZXREdXJhdGlvbihuZXdEdXJhdGlvbikge1xuICAgIHRoaXMuX2R1cmF0aW9uID0gbmV3RHVyYXRpb247XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLnBtdFBhcnNlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3BtdElkID0gdGhpcy5fYXZjSWQgPSB0aGlzLl9hYWNJZCA9IC0xO1xuICAgIHRoaXMuX2F2Y1RyYWNrID0ge3R5cGUgOiAndmlkZW8nLCBzZXF1ZW5jZU51bWJlciA6IDB9O1xuICAgIHRoaXMuX2FhY1RyYWNrID0ge3R5cGUgOiAnYXVkaW8nLCBzZXF1ZW5jZU51bWJlciA6IDB9O1xuICAgIHRoaXMuX2F2Y1NhbXBsZXMgPSBbXTtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1ID0gMDtcbiAgICB0aGlzLl9hYWNTYW1wbGVzID0gW107XG4gICAgdGhpcy5fYWFjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsYXVkaW9Db2RlYywgdmlkZW9Db2RlYyx0aW1lT2Zmc2V0KSB7XG4gICAgdGhpcy5hdWRpb0NvZGVjID0gYXVkaW9Db2RlYztcbiAgICB0aGlzLnZpZGVvQ29kZWMgPSB2aWRlb0NvZGVjO1xuICAgIHRoaXMudGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gICAgdmFyIG9mZnNldDtcbiAgICBmb3Iob2Zmc2V0ID0gMDsgb2Zmc2V0IDwgZGF0YS5sZW5ndGggOyBvZmZzZXQgKz0gMTg4KSB7XG4gICAgICB0aGlzLl9wYXJzZVRTUGFja2V0KGRhdGEsb2Zmc2V0KTtcbiAgICB9XG4gIH1cbiAgLy8gZmx1c2ggYW55IGJ1ZmZlcmVkIGRhdGFcbiAgZW5kKCkge1xuICAgIGlmKHRoaXMuX2F2Y0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKHRoaXMuX2F2Y0RhdGEpKTtcbiAgICAgIHRoaXMuX2F2Y0RhdGEgPSBudWxsO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFWQyBzYW1wbGVzOicgKyB0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYodGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQVZDU2FtcGxlcygpO1xuICAgIH1cbiAgICBpZih0aGlzLl9hYWNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyh0aGlzLl9hYWNEYXRhKSk7XG4gICAgICB0aGlzLl9hYWNEYXRhID0gbnVsbDtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBBQUMgc2FtcGxlczonICsgdGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmKHRoaXMuX2FhY1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLl9mbHVzaEFBQ1NhbXBsZXMoKTtcbiAgICB9XG4gICAgLy9ub3RpZnkgZW5kIG9mIHBhcnNpbmdcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0VEKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9pbml0RFRTID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX2R1cmF0aW9uID0gMDtcbiAgfVxuXG4gIF9wYXJzZVRTUGFja2V0KGRhdGEsc3RhcnQpIHtcbiAgICB2YXIgc3R0LHBpZCxhdGYsb2Zmc2V0O1xuICAgIGlmKGRhdGFbc3RhcnRdID09PSAweDQ3KSB7XG4gICAgICBzdHQgPSAhIShkYXRhW3N0YXJ0KzFdICYgMHg0MCk7XG4gICAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIFRTWzFdXG4gICAgICBwaWQgPSAoKGRhdGFbc3RhcnQrMV0gJiAweDFmKSA8PCA4KSArIGRhdGFbc3RhcnQrMl07XG4gICAgICBhdGYgPSAoZGF0YVtzdGFydCszXSAmIDB4MzApID4+IDQ7XG4gICAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGUgZmlmdGggYnl0ZSBvZiB0aGUgVFMgcGFja2V0IGhlYWRlci5cbiAgICAgIGlmKGF0ZiA+IDEpIHtcbiAgICAgICAgb2Zmc2V0ID0gc3RhcnQrNStkYXRhW3N0YXJ0KzRdO1xuICAgICAgICAvLyByZXR1cm4gaWYgdGhlcmUgaXMgb25seSBhZGFwdGF0aW9uIGZpZWxkXG4gICAgICAgIGlmKG9mZnNldCA9PT0gKHN0YXJ0KzE4OCkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9mZnNldCA9IHN0YXJ0KzQ7XG4gICAgICB9XG4gICAgICBpZih0aGlzLnBtdFBhcnNlZCkge1xuICAgICAgICBpZihwaWQgPT09IHRoaXMuX2F2Y0lkKSB7XG4gICAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgICBpZih0aGlzLl9hdmNEYXRhKSB7XG4gICAgICAgICAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKHRoaXMuX2F2Y0RhdGEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2F2Y0RhdGEgPSB7ZGF0YTogW10sc2l6ZTogMH07XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2F2Y0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LHN0YXJ0KzE4OCkpO1xuICAgICAgICAgIHRoaXMuX2F2Y0RhdGEuc2l6ZSs9c3RhcnQrMTg4LW9mZnNldDtcbiAgICAgICAgfSBlbHNlIGlmKHBpZCA9PT0gdGhpcy5fYWFjSWQpIHtcbiAgICAgICAgICBpZihzdHQpIHtcbiAgICAgICAgICAgIGlmKHRoaXMuX2FhY0RhdGEpIHtcbiAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVModGhpcy5fYWFjRGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fYWFjRGF0YSA9IHtkYXRhOiBbXSxzaXplOiAwfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fYWFjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsc3RhcnQrMTg4KSk7XG4gICAgICAgICAgdGhpcy5fYWFjRGF0YS5zaXplKz1zdGFydCsxODgtb2Zmc2V0O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZihzdHQpIHtcbiAgICAgICAgICBvZmZzZXQgKz0gZGF0YVtvZmZzZXRdICsgMTtcbiAgICAgICAgfVxuICAgICAgICBpZihwaWQgPT09IDApIHtcbiAgICAgICAgICB0aGlzLl9wYXJzZVBBVChkYXRhLG9mZnNldCk7XG4gICAgICAgIH0gZWxzZSBpZihwaWQgPT09IHRoaXMuX3BtdElkKSB7XG4gICAgICAgICAgdGhpcy5fcGFyc2VQTVQoZGF0YSxvZmZzZXQpO1xuICAgICAgICAgIHRoaXMucG10UGFyc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIubG9nKCdwYXJzaW5nIGVycm9yJyk7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEFUKGRhdGEsb2Zmc2V0KSB7XG4gICAgLy8gc2tpcCB0aGUgUFNJIGhlYWRlciBhbmQgcGFyc2UgdGhlIGZpcnN0IFBNVCBlbnRyeVxuICAgIHRoaXMuX3BtdElkICA9IChkYXRhW29mZnNldCsxMF0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQrMTFdO1xuICAgIC8vbG9nZ2VyLmxvZygnUE1UIFBJRDonICArIHRoaXMuX3BtdElkKTtcbiAgfVxuXG4gIF9wYXJzZVBNVChkYXRhLG9mZnNldCkge1xuICAgIHZhciBzZWN0aW9uTGVuZ3RoLHRhYmxlRW5kLHByb2dyYW1JbmZvTGVuZ3RoLHBpZDtcbiAgICBzZWN0aW9uTGVuZ3RoID0gKGRhdGFbb2Zmc2V0KzFdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0KzJdO1xuICAgIHRhYmxlRW5kID0gb2Zmc2V0ICsgMyArIHNlY3Rpb25MZW5ndGggLSA0O1xuICAgIC8vIHRvIGRldGVybWluZSB3aGVyZSB0aGUgdGFibGUgaXMsIHdlIGhhdmUgdG8gZmlndXJlIG91dCBob3dcbiAgICAvLyBsb25nIHRoZSBwcm9ncmFtIGluZm8gZGVzY3JpcHRvcnMgYXJlXG4gICAgcHJvZ3JhbUluZm9MZW5ndGggPSAoZGF0YVtvZmZzZXQrMTBdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0KzExXTtcblxuICAgIC8vIGFkdmFuY2UgdGhlIG9mZnNldCB0byB0aGUgZmlyc3QgZW50cnkgaW4gdGhlIG1hcHBpbmcgdGFibGVcbiAgICBvZmZzZXQgKz0gMTIgKyBwcm9ncmFtSW5mb0xlbmd0aDtcbiAgICB3aGlsZSAob2Zmc2V0IDwgdGFibGVFbmQpIHtcbiAgICAgIHBpZCA9IChkYXRhW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgICBzd2l0Y2goZGF0YVtvZmZzZXRdKSB7XG4gICAgICAgIC8vIElTTy9JRUMgMTM4MTgtNyBBRFRTIEFBQyAoTVBFRy0yIGxvd2VyIGJpdC1yYXRlIGF1ZGlvKVxuICAgICAgICBjYXNlIDB4MGY6XG4gICAgICAgIC8vbG9nZ2VyLmxvZygnQUFDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYWFjSWQgPSBwaWQ7XG4gICAgICAgICAgdGhpcy5fYWFjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBJVFUtVCBSZWMuIEguMjY0IGFuZCBJU08vSUVDIDE0NDk2LTEwIChsb3dlciBiaXQtcmF0ZSB2aWRlbylcbiAgICAgICAgY2FzZSAweDFiOlxuICAgICAgICAvL2xvZ2dlci5sb2coJ0FWQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICB0aGlzLl9hdmNJZCA9IHBpZDtcbiAgICAgICAgdGhpcy5fYXZjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICBsb2dnZXIubG9nKCd1bmtvd24gc3RyZWFtIHR5cGU6JyAgKyBkYXRhW29mZnNldF0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIG1vdmUgdG8gdGhlIG5leHQgdGFibGUgZW50cnlcbiAgICAgIC8vIHNraXAgcGFzdCB0aGUgZWxlbWVudGFyeSBzdHJlYW0gZGVzY3JpcHRvcnMsIGlmIHByZXNlbnRcbiAgICAgIG9mZnNldCArPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDBGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyA0XSkgKyA1O1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBFUyhzdHJlYW0pIHtcbiAgICB2YXIgaSA9IDAsZnJhZyxwZXNGbGFncyxwZXNQcmVmaXgscGVzTGVuLHBlc0hkckxlbixwZXNEYXRhLHBlc1B0cyxwZXNEdHMscGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgIC8vcmV0cmlldmUgUFRTL0RUUyBmcm9tIGZpcnN0IGZyYWdtZW50XG4gICAgZnJhZyA9IHN0cmVhbS5kYXRhWzBdO1xuICAgIHBlc1ByZWZpeCA9IChmcmFnWzBdIDw8IDE2KSArIChmcmFnWzFdIDw8IDgpICsgZnJhZ1syXTtcbiAgICBpZihwZXNQcmVmaXggPT09IDEpIHtcbiAgICAgIHBlc0xlbiA9IChmcmFnWzRdIDw8IDgpICsgZnJhZ1s1XTtcbiAgICAgIHBlc0ZsYWdzID0gZnJhZ1s3XTtcbiAgICAgIGlmIChwZXNGbGFncyAmIDB4QzApIHtcbiAgICAgICAgLy8gUEVTIGhlYWRlciBkZXNjcmliZWQgaGVyZSA6IGh0dHA6Ly9kdmQuc291cmNlZm9yZ2UubmV0L2R2ZGluZm8vcGVzLWhkci5odG1sXG4gICAgICAgIHBlc1B0cyA9IChmcmFnWzldICYgMHgwRSkgPDwgMjlcbiAgICAgICAgICB8IChmcmFnWzEwXSAmIDB4RkYpIDw8IDIyXG4gICAgICAgICAgfCAoZnJhZ1sxMV0gJiAweEZFKSA8PCAxNFxuICAgICAgICAgIHwgKGZyYWdbMTJdICYgMHhGRikgPDwgIDdcbiAgICAgICAgICB8IChmcmFnWzEzXSAmIDB4RkUpID4+PiAgMTtcbiAgICAgICAgaWYgKHBlc0ZsYWdzICYgMHg0MCkge1xuICAgICAgICAgIHBlc0R0cyA9IChmcmFnWzE0XSAmIDB4MEUgKSA8PCAyOVxuICAgICAgICAgICAgfCAoZnJhZ1sxNV0gJiAweEZGICkgPDwgMjJcbiAgICAgICAgICAgIHwgKGZyYWdbMTZdICYgMHhGRSApIDw8IDE0XG4gICAgICAgICAgICB8IChmcmFnWzE3XSAmIDB4RkYgKSA8PCA3XG4gICAgICAgICAgICB8IChmcmFnWzE4XSAmIDB4RkUgKSA+Pj4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZXNEdHMgPSBwZXNQdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlc0hkckxlbiA9IGZyYWdbOF07XG4gICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSBwZXNIZHJMZW4rOTtcbiAgICAgIC8vIHRyaW0gUEVTIGhlYWRlclxuICAgICAgc3RyZWFtLmRhdGFbMF0gPSBzdHJlYW0uZGF0YVswXS5zdWJhcnJheShwYXlsb2FkU3RhcnRPZmZzZXQpO1xuICAgICAgc3RyZWFtLnNpemUgLT0gcGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgICAgLy9yZWFzc2VtYmxlIFBFUyBwYWNrZXRcbiAgICAgIHBlc0RhdGEgPSBuZXcgVWludDhBcnJheShzdHJlYW0uc2l6ZSk7XG4gICAgICAvLyByZWFzc2VtYmxlIHRoZSBwYWNrZXRcbiAgICAgIHdoaWxlIChzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgZnJhZyA9IHN0cmVhbS5kYXRhLnNoaWZ0KCk7XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpICs9IGZyYWcuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IGRhdGEgOiBwZXNEYXRhLCBwdHMgOiBwZXNQdHMsIGR0cyA6IHBlc0R0cywgbGVuIDogcGVzTGVufTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlQVZDUEVTKHBlcykge1xuICAgIHZhciB1bml0cyx0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLGF2Y1NhbXBsZSxrZXkgPSBmYWxzZTtcbiAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSk7XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdW5pdHMudW5pdHMuZm9yRWFjaCh1bml0ID0+IHtcbiAgICAgIHN3aXRjaCh1bml0LnR5cGUpIHtcbiAgICAgICAgLy9JRFJcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgIGtleSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU1BTXG4gICAgICAgIGNhc2UgNzpcbiAgICAgICAgICBpZighdHJhY2suc3BzKSB7XG4gICAgICAgICAgICB2YXIgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcbiAgICAgICAgICAgIHZhciBjb25maWcgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRTZXF1ZW5jZVBhcmFtZXRlclNldCgpO1xuICAgICAgICAgICAgdHJhY2sud2lkdGggPSBjb25maWcud2lkdGg7XG4gICAgICAgICAgICB0cmFjay5oZWlnaHQgPSBjb25maWcuaGVpZ2h0O1xuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUlkYyA9IGNvbmZpZy5wcm9maWxlSWRjO1xuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUNvbXBhdGliaWxpdHkgPSBjb25maWcucHJvZmlsZUNvbXBhdGliaWxpdHk7XG4gICAgICAgICAgICB0cmFjay5sZXZlbElkYyA9IGNvbmZpZy5sZXZlbElkYztcbiAgICAgICAgICAgIHRyYWNrLnNwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgICAgdHJhY2suZHVyYXRpb24gPSA5MDAwMCp0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgICAgIHZhciBjb2RlY2FycmF5ID0gdW5pdC5kYXRhLnN1YmFycmF5KDEsNCk7XG4gICAgICAgICAgICB2YXIgY29kZWNzdHJpbmcgID0gJ2F2YzEuJztcbiAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICAgIGlmIChoLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGVjc3RyaW5nICs9IGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFjay5jb2RlYyA9IGNvZGVjc3RyaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9QUFNcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgIGlmKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvL2J1aWxkIHNhbXBsZSBmcm9tIFBFU1xuICAgIC8vIEFubmV4IEIgdG8gTVA0IGNvbnZlcnNpb24gdG8gYmUgZG9uZVxuICAgIGF2Y1NhbXBsZSA9IHsgdW5pdHMgOiB1bml0cywgcHRzIDogcGVzLnB0cywgZHRzIDogcGVzLmR0cyAsIGtleSA6IGtleX07XG4gICAgdGhpcy5fYXZjU2FtcGxlcy5wdXNoKGF2Y1NhbXBsZSk7XG4gICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCArPSB1bml0cy5sZW5ndGg7XG4gICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSArPSB1bml0cy51bml0cy5sZW5ndGg7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmKCF0aGlzLl9pbml0U2VnR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLl9nZW5lcmF0ZUluaXRTZWdtZW50KCk7XG4gICAgfVxuICB9XG5cblxuICBfZmx1c2hBVkNTYW1wbGVzKCkge1xuICAgIHZhciB2aWV3LGk9OCxhdmNTYW1wbGUsbXA0U2FtcGxlLG1wNFNhbXBsZUxlbmd0aCx1bml0LHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgIGxhc3RTYW1wbGVEVFMsbWRhdCxtb29mLGZpcnN0UFRTLGZpcnN0RFRTLHNhbXBsZXMgPSBbXTtcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYXZjU2FtcGxlc0xlbmd0aCArICg0ICogdGhpcy5fYXZjU2FtcGxlc05iTmFsdSkrOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCxtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LDQpO1xuICAgIHdoaWxlKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzLnNoaWZ0KCk7XG4gICAgICBtcDRTYW1wbGVMZW5ndGggPSAwO1xuXG4gICAgICAvLyBjb252ZXJ0IE5BTFUgYml0c3RyZWFtIHRvIE1QNCBmb3JtYXQgKHByZXBlbmQgTkFMVSB3aXRoIHNpemUgZmllbGQpXG4gICAgICB3aGlsZShhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIHVuaXQgPSBhdmNTYW1wbGUudW5pdHMudW5pdHMuc2hpZnQoKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIoaSwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBpICs9IDQ7XG4gICAgICAgIG1kYXQuc2V0KHVuaXQuZGF0YSwgaSk7XG4gICAgICAgIGkgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCs9NCt1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgYXZjU2FtcGxlLnB0cyAtPSB0aGlzLl9pbml0RFRTO1xuICAgICAgYXZjU2FtcGxlLmR0cyAtPSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKCdWaWRlby9QVFMvRFRTOicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyk7XG5cbiAgICAgIGlmKGxhc3RTYW1wbGVEVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBhdmNTYW1wbGUuZHRzIC0gbGFzdFNhbXBsZURUUztcbiAgICAgICAgaWYobXA0U2FtcGxlLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnaW52YWxpZCBzYW1wbGUgZHVyYXRpb24gYXQgUFRTL0RUUzo6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzICsgJzonICsgbXA0U2FtcGxlLmR1cmF0aW9uKTtcbiAgICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjaGVjayBpZiBmcmFnbWVudHMgYXJlIGNvbnRpZ3VvdXMgKGkuZS4gbm8gbWlzc2luZyBmcmFtZXMgYmV0d2VlbiBmcmFnbWVudClcbiAgICAgICAgaWYodGhpcy5uZXh0QXZjUHRzKSB7XG4gICAgICAgICAgdmFyIGRlbHRhID0gKGF2Y1NhbXBsZS5wdHMgLSB0aGlzLm5leHRBdmNQdHMpLzkwLGFic2RlbHRhPU1hdGguYWJzKGRlbHRhKTtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fic2RlbHRhL2F2Y1NhbXBsZS5wdHM6JyArIGFic2RlbHRhICsgJy8nICsgYXZjU2FtcGxlLnB0cyk7XG4gICAgICAgICAgLy8gaWYgZGVsdGEgaXMgbGVzcyB0aGFuIDMwMCBtcywgbmV4dCBsb2FkZWQgZnJhZ21lbnQgaXMgYXNzdW1lZCB0byBiZSBjb250aWd1b3VzIHdpdGggbGFzdCBvbmVcbiAgICAgICAgICBpZihhYnNkZWx0YSA8IDMwMCkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdWaWRlbyBuZXh0IFBUUzonICsgdGhpcy5uZXh0QXZjUHRzKTtcbiAgICAgICAgICAgIGlmKGRlbHRhID4gMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHtkZWx0YS50b0ZpeGVkKDApfSBtcyBob2xlIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkLGZpbGxpbmcgaXRgKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHsoLWRlbHRhLnRvRml4ZWQoMCkpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IFBUU1xuICAgICAgICAgICAgYXZjU2FtcGxlLnB0cyA9IHRoaXMubmV4dEF2Y1B0cztcbiAgICAgICAgICAgIC8vIG9mZnNldCBEVFMgYXMgd2VsbCwgZW5zdXJlIHRoYXQgRFRTIGlzIHNtYWxsZXIgb3IgZXF1YWwgdGhhbiBuZXcgUFRTXG4gICAgICAgICAgICBhdmNTYW1wbGUuZHRzID0gTWF0aC5tYXgoYXZjU2FtcGxlLmR0cy1kZWx0YSwgdGhpcy5sYXN0QXZjRHRzKTtcbiAgICAgICAgICAgLy8gbG9nZ2VyLmxvZygnVmlkZW8vUFRTL0RUUyBhZGp1c3RlZDonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGF2Y1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsYXZjU2FtcGxlLnB0cyk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCxhdmNTYW1wbGUuZHRzKTtcbiAgICAgIH1cblxuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgIGNvbXBvc2l0aW9uVGltZU9mZnNldDogYXZjU2FtcGxlLnB0cyAtIGF2Y1NhbXBsZS5kdHMsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZGF0aW9uUHJpb3JpdHk6IDBcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgaWYoYXZjU2FtcGxlLmtleSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyB0aGUgY3VycmVudCBzYW1wbGUgaXMgYSBrZXkgZnJhbWVcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA9IDE7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUgPSAxO1xuICAgICAgfVxuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0U2FtcGxlRFRTID0gYXZjU2FtcGxlLmR0cztcbiAgICB9XG4gICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gc2FtcGxlc1tzYW1wbGVzLmxlbmd0aC0yXS5kdXJhdGlvbjtcbiAgICB0aGlzLmxhc3RBdmNEdHMgPSBhdmNTYW1wbGUuZHRzO1xuICAgIC8vIG5leHQgQVZDIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QXZjUHRzID0gYXZjU2FtcGxlLnB0cyArIG1wNFNhbXBsZS5kdXJhdGlvbjtcbiAgICAvL2xvZ2dlci5sb2coJ1ZpZGVvL2xhc3RBdmNEdHMvbmV4dEF2Y1B0czonICsgdGhpcy5sYXN0QXZjRHRzICsgJy8nICsgdGhpcy5uZXh0QXZjUHRzKTtcblxuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgPSAwO1xuXG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssZmlyc3REVFMsdHJhY2spO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFMgOiBmaXJzdFBUUy85MDAwMCxcbiAgICAgIGVuZFBUUyA6IHRoaXMubmV4dEF2Y1B0cy85MDAwMCxcbiAgICAgIHN0YXJ0RFRTIDogZmlyc3REVFMvOTAwMDAsXG4gICAgICBlbmREVFMgOiAoYXZjU2FtcGxlLmR0cyArIG1wNFNhbXBsZS5kdXJhdGlvbikvOTAwMDAsXG4gICAgICB0eXBlIDogJ3ZpZGVvJyxcbiAgICAgIG5iIDogc2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIF9wYXJzZUFWQ05BTHUoYXJyYXkpIHtcbiAgICB2YXIgaSA9IDAsbGVuID0gYXJyYXkuYnl0ZUxlbmd0aCx2YWx1ZSxvdmVyZmxvdyxzdGF0ZSA9IDA7XG4gICAgdmFyIHVuaXRzID0gW10sIHVuaXQsIHVuaXRUeXBlLCBsYXN0VW5pdFN0YXJ0LGxhc3RVbml0VHlwZSxsZW5ndGggPSAwO1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChhcnJheSkpO1xuXG4gICAgd2hpbGUoaTwgbGVuKSB7XG4gICAgICB2YWx1ZSA9IGFycmF5W2krK107XG4gICAgICAvLyBmaW5kaW5nIDMgb3IgNC1ieXRlIHN0YXJ0IGNvZGVzICgwMCAwMCAwMSBPUiAwMCAwMCAwMCAwMSlcbiAgICAgIHN3aXRjaChzdGF0ZSkge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAzO1xuICAgICAgICAgIH0gZWxzZSBpZih2YWx1ZSA9PT0gMSkge1xuICAgICAgICAgICAgdW5pdFR5cGUgPSBhcnJheVtpXSAmIDB4MWY7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgTkFMVSBAIG9mZnNldDonICsgaSArICcsdHlwZTonICsgdW5pdFR5cGUpO1xuICAgICAgICAgICAgaWYobGFzdFVuaXRTdGFydCkge1xuICAgICAgICAgICAgICB1bml0ID0geyBkYXRhIDogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCxpLXN0YXRlLTEpLCB0eXBlIDogbGFzdFVuaXRUeXBlfTtcbiAgICAgICAgICAgICAgbGVuZ3RoKz1pLXN0YXRlLTEtbGFzdFVuaXRTdGFydDtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgTkFMIHVuaXRzIGFyZSBub3Qgc3RhcnRpbmcgcmlnaHQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgUEVTIHBhY2tldCwgcHVzaCBwcmVjZWRpbmcgZGF0YSBpbnRvIHByZXZpb3VzIE5BTCB1bml0LlxuICAgICAgICAgICAgICBvdmVyZmxvdyAgPSBpIC0gc3RhdGUgLSAxO1xuICAgICAgICAgICAgICBpZiAob3ZlcmZsb3cpIHtcbiAgICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICBpZih0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHRoaXMuX2F2Y1NhbXBsZXNbdGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgtMV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgtMV07XG4gICAgICAgICAgICAgICAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgrb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsMCk7XG4gICAgICAgICAgICAgICAgICAgIHRtcC5zZXQoYXJyYXkuc3ViYXJyYXkoMCxvdmVyZmxvdyksbGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGgrPW92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoKz1vdmVyZmxvdztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIGlmKHVuaXRUeXBlID09PSAxIHx8IHVuaXRUeXBlID09PSA1KSB7XG4gICAgICAgICAgICAgIC8vIE9QVEkgISEhIGlmIElEUi9ORFIgdW5pdCwgY29uc2lkZXIgaXQgaXMgbGFzdCBOQUx1XG4gICAgICAgICAgICAgIGkgPSBsZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgIHVuaXQgPSB7IGRhdGEgOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LGxlbiksIHR5cGUgOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgbGVuZ3RoKz1sZW4tbGFzdFVuaXRTdGFydDtcbiAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiB7IHVuaXRzIDogdW5pdHMgLCBsZW5ndGggOiBsZW5ndGh9O1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLGFhY1NhbXBsZSxkYXRhID0gcGVzLmRhdGEsY29uZmlnLGFkdHNGcmFtZVNpemUsYWR0c1N0YXJ0T2Zmc2V0LGFkdHNIZWFkZXJMZW4sc3RhbXAsaTtcbiAgICBpZih0aGlzLmFhY092ZXJGbG93KSB7XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5hYWNPdmVyRmxvdy5ieXRlTGVuZ3RoK2RhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KHRoaXMuYWFjT3ZlckZsb3csMCk7XG4gICAgICB0bXAuc2V0KGRhdGEsdGhpcy5hYWNPdmVyRmxvdy5ieXRlTGVuZ3RoKTtcbiAgICAgIGRhdGEgPSB0bXA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChkYXRhKSk7XG4gICAgaWYoZGF0YVswXSA9PT0gMHhmZikge1xuICAgICAgaWYoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgICBjb25maWcgPSB0aGlzLl9BRFRTdG9BdWRpb0NvbmZpZyhwZXMuZGF0YSx0aGlzLmF1ZGlvQ29kZWMpO1xuICAgICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICAgIHRyYWNrLmR1cmF0aW9uID0gOTAwMDAqdGhpcy5fZHVyYXRpb247XG4gICAgICAgIGNvbnNvbGUubG9nKGBwYXJzZWQgICBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgICAgfVxuICAgICAgYWR0c1N0YXJ0T2Zmc2V0ID0gaSA9IDA7XG4gICAgICB3aGlsZSgoYWR0c1N0YXJ0T2Zmc2V0ICsgNSkgPCBkYXRhLmxlbmd0aCkge1xuICAgICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICAgIGFkdHNGcmFtZVNpemUgPSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzNdICYgMHgwMykgPDwgMTEpO1xuICAgICAgICAvLyBieXRlIDRcbiAgICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoZGF0YVthZHRzU3RhcnRPZmZzZXQrNF0gPDwgMyk7XG4gICAgICAgIC8vIGJ5dGUgNVxuICAgICAgICBhZHRzRnJhbWVTaXplIHw9ICgoZGF0YVthZHRzU3RhcnRPZmZzZXQrNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICAgIGFkdHNIZWFkZXJMZW4gPSAoISEoZGF0YVthZHRzU3RhcnRPZmZzZXQrMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgICAgYWR0c0ZyYW1lU2l6ZSAtPSBhZHRzSGVhZGVyTGVuO1xuICAgICAgICBzdGFtcCA9IHBlcy5wdHMgKyBpKjEwMjQqOTAwMDAvdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgICAvL3N0YW1wID0gcGVzLnB0cztcbiAgICAgICAgLy9jb25zb2xlLmxvZygnQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3B0czonICsgKGFkdHNTdGFydE9mZnNldCs3KSArICcvJyArIGFkdHNGcmFtZVNpemUgKyAnLycgKyBzdGFtcC50b0ZpeGVkKDApKTtcbiAgICAgICAgaWYoYWR0c1N0YXJ0T2Zmc2V0K2FkdHNIZWFkZXJMZW4rYWR0c0ZyYW1lU2l6ZSA8PSBkYXRhLmxlbmd0aCkge1xuICAgICAgICAgIGFhY1NhbXBsZSA9IHsgdW5pdCA6IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0K2FkdHNIZWFkZXJMZW4sYWR0c1N0YXJ0T2Zmc2V0K2FkdHNIZWFkZXJMZW4rYWR0c0ZyYW1lU2l6ZSkgLCBwdHMgOiBzdGFtcCwgZHRzIDogc3RhbXB9O1xuICAgICAgICAgIHRoaXMuX2FhY1NhbXBsZXMucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggKz0gYWR0c0ZyYW1lU2l6ZTtcbiAgICAgICAgICBhZHRzU3RhcnRPZmZzZXQrPWFkdHNGcmFtZVNpemUrYWR0c0hlYWRlckxlbjtcbiAgICAgICAgICBpKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfRVJST1IsJ1N0cmVhbSBkaWQgbm90IHN0YXJ0IHdpdGggQURUUyBoZWFkZXIuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmKCF0aGlzLl9pbml0U2VnR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLl9nZW5lcmF0ZUluaXRTZWdtZW50KCk7XG4gICAgfVxuICAgIGlmKGFkdHNTdGFydE9mZnNldCA8IGRhdGEubGVuZ3RoKSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShhZHRzU3RhcnRPZmZzZXQsZGF0YS5sZW5ndGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfZmx1c2hBQUNTYW1wbGVzKCkge1xuICAgIHZhciB2aWV3LGk9OCxhYWNTYW1wbGUsbXA0U2FtcGxlLHVuaXQsdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxcbiAgICAgICAgbGFzdFNhbXBsZURUUyxtZGF0LG1vb2YsZmlyc3RQVFMsZmlyc3REVFMsc2FtcGxlcyA9IFtdO1xuXG4gICAgLyogY29uY2F0ZW5hdGUgdGhlIGF1ZGlvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtcGRhdCB0eXBlKSAqL1xuICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoKzgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsbWRhdC5ieXRlTGVuZ3RoKTtcbiAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCw0KTtcbiAgICB3aGlsZSh0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgYWFjU2FtcGxlID0gdGhpcy5fYWFjU2FtcGxlcy5zaGlmdCgpO1xuICAgICAgdW5pdCA9IGFhY1NhbXBsZS51bml0O1xuICAgICAgbWRhdC5zZXQodW5pdCwgaSk7XG4gICAgICBpICs9IHVuaXQuYnl0ZUxlbmd0aDtcblxuICAgICAgYWFjU2FtcGxlLnB0cyAtPSB0aGlzLl9pbml0RFRTO1xuICAgICAgYWFjU2FtcGxlLmR0cyAtPSB0aGlzLl9pbml0RFRTO1xuXG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUzonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApKTtcbiAgICAgIGlmKGxhc3RTYW1wbGVEVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyB3ZSB1c2UgRFRTIHRvIGNvbXB1dGUgc2FtcGxlIGR1cmF0aW9uLCBidXQgd2UgdXNlIFBUUyB0byBjb21wdXRlIGluaXRQVFMgd2hpY2ggaXMgdXNlZCB0byBzeW5jIGF1ZGlvIGFuZCB2aWRlb1xuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBhYWNTYW1wbGUuZHRzIC0gbGFzdFNhbXBsZURUUztcbiAgICAgICAgaWYobXA0U2FtcGxlLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnaW52YWxpZCBzYW1wbGUgZHVyYXRpb24gYXQgUFRTL0RUUzo6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzICsgJzonICsgbXA0U2FtcGxlLmR1cmF0aW9uKTtcbiAgICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjaGVjayBpZiBmcmFnbWVudHMgYXJlIGNvbnRpZ3VvdXMgKGkuZS4gbm8gbWlzc2luZyBmcmFtZXMgYmV0d2VlbiBmcmFnbWVudClcbiAgICAgICAgaWYodGhpcy5uZXh0QWFjUHRzICYmIHRoaXMubmV4dEFhY1B0cyAhPT0gYWFjU2FtcGxlLnB0cykge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8gbmV4dCBQVFM6JyArIHRoaXMubmV4dEFhY1B0cyk7XG4gICAgICAgICAgdmFyIGRlbHRhID0gKGFhY1NhbXBsZS5wdHMgLSB0aGlzLm5leHRBYWNQdHMpLzkwO1xuICAgICAgICAgIC8vIGlmIGRlbHRhIGlzIGxlc3MgdGhhbiAzMDAgbXMsIG5leHQgbG9hZGVkIGZyYWdtZW50IGlzIGFzc3VtZWQgdG8gYmUgY29udGlndW91cyB3aXRoIGxhc3Qgb25lXG4gICAgICAgICAgaWYoTWF0aC5hYnMoZGVsdGEpID4gMSAmJiBNYXRoLmFicyhkZWx0YSkgPCAzMDApIHtcbiAgICAgICAgICAgIGlmKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKCdBQUM6JyArIGRlbHRhLnRvRml4ZWQoMCkgKyAnIG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdCcpO1xuICAgICAgICAgICAgICAvLyBzZXQgUFRTIHRvIG5leHQgUFRTLCBhbmQgZW5zdXJlIFBUUyBpcyBncmVhdGVyIG9yIGVxdWFsIHRoYW4gbGFzdCBEVFNcbiAgICAgICAgICAgICAgYWFjU2FtcGxlLnB0cyA9IE1hdGgubWF4KHRoaXMubmV4dEFhY1B0cywgdGhpcy5sYXN0QWFjRHRzKTtcbiAgICAgICAgICAgICAgYWFjU2FtcGxlLmR0cyA9IGFhY1NhbXBsZS5wdHM7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8vUFRTL0RUUyBhZGp1c3RlZDonICsgYWFjU2FtcGxlLnB0cyArICcvJyArIGFhY1NhbXBsZS5kdHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnQUFDOicgKyAoLWRlbHRhLnRvRml4ZWQoMCkpICsgJyBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGFhY1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsYWFjU2FtcGxlLnB0cyk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCxhYWNTYW1wbGUuZHRzKTtcbiAgICAgIH1cblxuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiB1bml0LmJ5dGVMZW5ndGgsXG4gICAgICAgIGNvbXBvc2l0aW9uVGltZU9mZnNldDogMCxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkYXRpb25Qcmlvcml0eTogMCxcbiAgICAgICAgICBkZXBlbmRzT24gOiAxLFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0U2FtcGxlRFRTID0gYWFjU2FtcGxlLmR0cztcbiAgICB9XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGgtMl0uZHVyYXRpb247XG4gICAgdGhpcy5sYXN0QWFjRHRzID0gYWFjU2FtcGxlLmR0cztcbiAgICAvLyBuZXh0IGFhYyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgIHRoaXMubmV4dEFhY1B0cyA9IGFhY1NhbXBsZS5wdHMgKyBtcDRTYW1wbGUuZHVyYXRpb247XG4gICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvUFRTZW5kOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkgKyAnLycgKyB0aGlzLm5leHRBYWNEdHMudG9GaXhlZCgwKSk7XG5cbiAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKyxmaXJzdERUUyx0cmFjayk7XG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUyA6IGZpcnN0UFRTLzkwMDAwLFxuICAgICAgZW5kUFRTIDogdGhpcy5uZXh0QWFjUHRzLzkwMDAwLFxuICAgICAgc3RhcnREVFMgOiBmaXJzdERUUy85MDAwMCxcbiAgICAgIGVuZERUUyA6IChhYWNTYW1wbGUuZHRzICsgbXA0U2FtcGxlLmR1cmF0aW9uKS85MDAwMCxcbiAgICAgIHR5cGUgOiAnYXVkaW8nLFxuICAgICAgbmIgOiBzYW1wbGVzLmxlbmd0aFxuICAgIH0pO1xuICB9XG5cbiAgX0FEVFN0b0F1ZGlvQ29uZmlnKGRhdGEsYXVkaW9Db2RlYykge1xuICAgIHZhciBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNDaGFuZWxDb25maWcsIC8vIDppbnRcbiAgICAgICAgY29uZmlnLFxuICAgICAgICB1c2VyQWdlbnQgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGFkdHNTYW1wbGVpbmdSYXRlcyA9IFtcbiAgICAgICAgICAgIDk2MDAwLCA4ODIwMCxcbiAgICAgICAgICAgIDY0MDAwLCA0ODAwMCxcbiAgICAgICAgICAgIDQ0MTAwLCAzMjAwMCxcbiAgICAgICAgICAgIDI0MDAwLCAyMjA1MCxcbiAgICAgICAgICAgIDE2MDAwLCAxMjAwMFxuICAgICAgICAgIF07XG5cbiAgICAvLyBieXRlIDJcbiAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVsyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgYWR0c1NhbXBsZWluZ0luZGV4ID0gKChkYXRhWzJdICYgMHgzQykgPj4+IDIpO1xuICAgIGFkdHNDaGFuZWxDb25maWcgPSAoKGRhdGFbMl0gJiAweDAxKSA8PCAyKTtcbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVszXSAmIDB4QzApID4+PiA2KTtcblxuICAgIGNvbnNvbGUubG9nKGBtYW5pZmVzdCBjb2RlYzoke2F1ZGlvQ29kZWN9LEFEVFMgZGF0YTp0eXBlOiR7YWR0c09iamVjdFR5cGV9LHNhbXBsZWluZ0luZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fVske2FkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdfWtIel0sY2hhbm5lbENvbmZpZzoke2FkdHNDaGFuZWxDb25maWd9YCk7XG5cblxuICAgIC8vIGZpcmVmb3g6IGZyZXEgbGVzcyB0aGFuIDI0a0h6ID0gQUFDIFNCUiAoSEUtQUFDKVxuICAgIGlmKHVzZXJBZ2VudC5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xKSB7XG4gICAgICBpZihhZHRzU2FtcGxlaW5nSW5kZXggPj02KSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4LTM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgICAgLy8gQW5kcm9pZCA6IGFsd2F5cyB1c2UgQUFDXG4gICAgfSBlbHNlIGlmKHVzZXJBZ2VudC5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qICBmb3Igb3RoZXIgYnJvd3NlcnMgKGNocm9tZSAuLi4pXG4gICAgICAgICAgYWx3YXlzIGZvcmNlIGF1ZGlvIHR5cGUgdG8gYmUgSEUtQUFDIFNCUiwgYXMgc29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2ggcHJvcGVybHkgKGxpa2UgQ2hyb21lIC4uLilcbiAgICAgICovXG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBIRS1BQUMpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIEFORCBmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6KVxuICAgICAgaWYoKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkgfHwgKCFhdWRpb0NvZGVjICYmIGFkdHNTYW1wbGVpbmdJbmRleCA+PTYpKSAge1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgQUFDKSBBTkQgKGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHogT1IgbmIgY2hhbm5lbCBpcyAxKVxuICAgICAgICBpZihhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yJykgIT09LTEgJiYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2IHx8IGFkdHNDaGFuZWxDb25maWcgPT09MSkpIHtcbiAgICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICB9XG4gIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgIElTTyAxNDQ5Ni0zIChBQUMpLnBkZiAtIFRhYmxlIDEuMTMg4oCUIFN5bnRheCBvZiBBdWRpb1NwZWNpZmljQ29uZmlnKClcbiAgICBBdWRpbyBQcm9maWxlIC8gQXVkaW8gT2JqZWN0IFR5cGVcbiAgICAwOiBOdWxsXG4gICAgMTogQUFDIE1haW5cbiAgICAyOiBBQUMgTEMgKExvdyBDb21wbGV4aXR5KVxuICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgIDQ6IEFBQyBMVFAgKExvbmcgVGVybSBQcmVkaWN0aW9uKVxuICAgIDU6IFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbilcbiAgICA2OiBBQUMgU2NhbGFibGVcbiAgIHNhbXBsaW5nIGZyZXFcbiAgICAwOiA5NjAwMCBIelxuICAgIDE6IDg4MjAwIEh6XG4gICAgMjogNjQwMDAgSHpcbiAgICAzOiA0ODAwMCBIelxuICAgIDQ6IDQ0MTAwIEh6XG4gICAgNTogMzIwMDAgSHpcbiAgICA2OiAyNDAwMCBIelxuICAgIDc6IDIyMDUwIEh6XG4gICAgODogMTYwMDAgSHpcbiAgICA5OiAxMjAwMCBIelxuICAgIDEwOiAxMTAyNSBIelxuICAgIDExOiA4MDAwIEh6XG4gICAgMTI6IDczNTAgSHpcbiAgICAxMzogUmVzZXJ2ZWRcbiAgICAxNDogUmVzZXJ2ZWRcbiAgICAxNTogZnJlcXVlbmN5IGlzIHdyaXR0ZW4gZXhwbGljdGx5XG4gICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAwOiBEZWZpbmVkIGluIEFPVCBTcGVjaWZjIENvbmZpZ1xuICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgKi9cbiAgICAvLyBhdWRpb09iamVjdFR5cGUgPSBwcm9maWxlID0+IHByb2ZpbGUsIHRoZSBNUEVHLTQgQXVkaW8gT2JqZWN0IFR5cGUgbWludXMgMVxuICAgIGNvbmZpZ1swXSA9IGFkdHNPYmplY3RUeXBlIDw8IDM7XG4gICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgIGNvbmZpZ1swXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICBjb25maWdbMV0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICBjb25maWdbMV0gfD0gYWR0c0NoYW5lbENvbmZpZyA8PCAzO1xuICAgIGlmKGFkdHNPYmplY3RUeXBlID09PSA1KSB7XG4gICAgICAvLyBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXhcbiAgICAgIGNvbmZpZ1sxXSB8PSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICAgIGNvbmZpZ1syXSA9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgICAgLy8gYWR0c09iamVjdFR5cGUgKGZvcmNlIHRvIDIsIGNocm9tZSBpcyBjaGVja2luZyB0aGF0IG9iamVjdCB0eXBlIGlzIGxlc3MgdGhhbiA1ID8/P1xuICAgICAgLy8gICAgaHR0cHM6Ly9jaHJvbWl1bS5nb29nbGVzb3VyY2UuY29tL2Nocm9taXVtL3NyYy5naXQvKy9tYXN0ZXIvbWVkaWEvZm9ybWF0cy9tcDQvYWFjLmNjXG4gICAgICBjb25maWdbMl0gfD0gMiA8PCAyO1xuICAgICAgY29uZmlnWzNdID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIHsgY29uZmlnIDogY29uZmlnLCBzYW1wbGVyYXRlIDogYWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF0sIGNoYW5uZWxDb3VudCA6IGFkdHNDaGFuZWxDb25maWcsIGNvZGVjIDogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG5cbiAgX2dlbmVyYXRlSW5pdFNlZ21lbnQoKSB7XG4gICAgaWYodGhpcy5fYXZjSWQgPT09IC0xKSB7XG4gICAgICAvL2F1ZGlvIG9ubHlcbiAgICAgIGlmKHRoaXMuX2FhY1RyYWNrLmNvbmZpZykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULHtcbiAgICAgICAgICBhdWRpb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYWFjVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjIDogdGhpcy5fYWFjVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQgOiB0aGlzLl9hYWNUcmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICB0aGlzLl9pbml0RFRTID0gdGhpcy5fYWFjU2FtcGxlc1swXS5kdHMgLSA5MDAwMCp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICB9XG4gICAgfSBlbHNlXG4gICAgaWYodGhpcy5fYWFjSWQgPT09IC0xKSB7XG4gICAgICAvL3ZpZGVvIG9ubHlcbiAgICAgIGlmKHRoaXMuX2F2Y1RyYWNrLnNwcyAmJiB0aGlzLl9hdmNUcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgdmlkZW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2F2Y1RyYWNrXSksXG4gICAgICAgICAgdmlkZW9Db2RlYyA6IHRoaXMuX2F2Y1RyYWNrLmNvZGVjLFxuICAgICAgICAgIHZpZGVvV2lkdGggOiB0aGlzLl9hdmNUcmFjay53aWR0aCxcbiAgICAgICAgICB2aWRlb0hlaWdodCA6IHRoaXMuX2F2Y1RyYWNrLmhlaWdodFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICAgIGlmKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5fYXZjU2FtcGxlc1swXS5wdHMgLSA5MDAwMCp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2F2Y1NhbXBsZXNbMF0uZHRzIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vYXVkaW8gYW5kIHZpZGVvXG4gICAgICBpZih0aGlzLl9hYWNUcmFjay5jb25maWcgJiYgdGhpcy5fYXZjVHJhY2suc3BzICYmIHRoaXMuX2F2Y1RyYWNrLnBwcykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULHtcbiAgICAgICAgICBhdWRpb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYWFjVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjIDogdGhpcy5fYWFjVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQgOiB0aGlzLl9hYWNUcmFjay5jaGFubmVsQ291bnQsXG4gICAgICAgICAgdmlkZW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2F2Y1RyYWNrXSksXG4gICAgICAgICAgdmlkZW9Db2RlYyA6IHRoaXMuX2F2Y1RyYWNrLmNvZGVjLFxuICAgICAgICAgIHZpZGVvV2lkdGggOiB0aGlzLl9hdmNUcmFjay53aWR0aCxcbiAgICAgICAgICB2aWRlb0hlaWdodCA6IHRoaXMuX2F2Y1RyYWNrLmhlaWdodFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICAgIGlmKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgICB0aGlzLl9pbml0UFRTID0gTWF0aC5taW4odGhpcy5fYXZjU2FtcGxlc1swXS5wdHMsdGhpcy5fYWFjU2FtcGxlc1swXS5wdHMpIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICAgIHRoaXMuX2luaXREVFMgPSBNYXRoLm1pbih0aGlzLl9hdmNTYW1wbGVzWzBdLmR0cyx0aGlzLl9hYWNTYW1wbGVzWzBdLmR0cykgLSA5MDAwMCp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVFNEZW11eGVyO1xuIiwiIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBUU0RlbXV4ZXIgICAgICAgICAgICBmcm9tICcuLi9kZW11eC90c2RlbXV4ZXInO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG5cbnZhciBUU0RlbXV4ZXJXb3JrZXIgPSBmdW5jdGlvbiAoc2VsZikge1xuICAgIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsZnVuY3Rpb24gKGV2KSB7XG4gICAgICAvL2NvbnNvbGUubG9nKCdkZW11eGVyIGNtZDonICsgZXYuZGF0YS5jbWQpO1xuICAgICAgc3dpdGNoKGV2LmRhdGEuY21kKSB7XG4gICAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZHVyYXRpb24nOlxuICAgICAgICAgIHNlbGYuZGVtdXhlci5zZXREdXJhdGlvbihldi5kYXRhLmRhdGEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdzd2l0Y2hMZXZlbCc6XG4gICAgICAgICAgc2VsZi5kZW11eGVyLnN3aXRjaExldmVsKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2RlbXV4JzpcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShldi5kYXRhLmRhdGEpLCBldi5kYXRhLmF1ZGlvQ29kZWMsZXYuZGF0YS52aWRlb0NvZGVjLCBldi5kYXRhLnRpbWVPZmZzZXQpO1xuICAgICAgICAgIHNlbGYuZGVtdXhlci5lbmQoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGxpc3RlbiB0byBldmVudHMgdHJpZ2dlcmVkIGJ5IFRTIERlbXV4ZXJcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBmdW5jdGlvbihldixkYXRhKSB7XG4gICAgICB2YXIgb2JqRGF0YSA9IHsgZXZlbnQgOiBldiB9O1xuICAgICAgdmFyIG9ialRyYW5zZmVyYWJsZSA9IFtdO1xuICAgICAgaWYoZGF0YS5hdWRpb0NvZGVjKSB7XG4gICAgICAgIG9iakRhdGEuYXVkaW9Db2RlYyA9IGRhdGEuYXVkaW9Db2RlYztcbiAgICAgICAgb2JqRGF0YS5hdWRpb01vb3YgPSBkYXRhLmF1ZGlvTW9vdi5idWZmZXI7XG4gICAgICAgIG9iakRhdGEuYXVkaW9DaGFubmVsQ291bnQgPSBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50O1xuICAgICAgICBvYmpUcmFuc2ZlcmFibGUucHVzaChvYmpEYXRhLmF1ZGlvTW9vdik7XG4gICAgICB9XG4gICAgICBpZihkYXRhLnZpZGVvQ29kZWMpIHtcbiAgICAgICAgb2JqRGF0YS52aWRlb0NvZGVjID0gZGF0YS52aWRlb0NvZGVjO1xuICAgICAgICBvYmpEYXRhLnZpZGVvTW9vdiA9IGRhdGEudmlkZW9Nb292LmJ1ZmZlcjtcbiAgICAgICAgb2JqRGF0YS52aWRlb1dpZHRoID0gZGF0YS52aWRlb1dpZHRoO1xuICAgICAgICBvYmpEYXRhLnZpZGVvSGVpZ2h0ID0gZGF0YS52aWRlb0hlaWdodDtcbiAgICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS52aWRlb01vb3YpO1xuICAgICAgfVxuICAgICAgLy8gcGFzcyBtb292IGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsb2JqVHJhbnNmZXJhYmxlKTtcbiAgICB9KTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgZnVuY3Rpb24oZXYsZGF0YSkge1xuICAgICAgdmFyIG9iakRhdGEgPSB7IGV2ZW50IDogZXYgLCB0eXBlIDogZGF0YS50eXBlLCBzdGFydFBUUyA6IGRhdGEuc3RhcnRQVFMsIGVuZFBUUyA6IGRhdGEuZW5kUFRTICwgc3RhcnREVFMgOiBkYXRhLnN0YXJ0RFRTLCBlbmREVFMgOiBkYXRhLmVuZERUUyAsbW9vZiA6IGRhdGEubW9vZi5idWZmZXIsIG1kYXQgOiBkYXRhLm1kYXQuYnVmZmVyLCBuYiA6IGRhdGEubmJ9O1xuICAgICAgLy8gcGFzcyBtb29mL21kYXQgZGF0YSBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLFtvYmpEYXRhLm1vb2Ysb2JqRGF0YS5tZGF0XSk7XG4gICAgfSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIGZ1bmN0aW9uKGV2KSB7XG4gICAgICB2YXIgb2JqRGF0YSA9IHsgZXZlbnQgOiBldiB9O1xuICAgICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgICB9KTtcbiAgfTtcblxuZXhwb3J0IGRlZmF1bHQgVFNEZW11eGVyV29ya2VyO1xuXG4iLCJleHBvcnQgZGVmYXVsdCB7XG4gIC8vIGZpcmVkIHdoZW4gTWVkaWFTb3VyY2UgaGFzIGJlZW4gc3VjY2VzZnVsbHkgYXR0YWNoZWQgdG8gdmlkZW8gZWxlbWVudCAtIGRhdGE6IHsgbWVkaWFTb3VyY2UgfVxuICBNU0VfQVRUQUNIRUQgOiAnaGxzTWVkaWFTb3VyY2VBdHRhY2hlZCcsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIGxvYWRlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCB1cmwgOiBtYW5pZmVzdFVSTCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX19XG4gIE1BTklGRVNUX0xPQURFRCAgOiAnaGxzTWFuaWZlc3RMb2FkZWQnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBwYXJzZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgc3RhcnRMZXZlbCA6IHBsYXliYWNrIHN0YXJ0IGxldmVsLCBhdWRpb2NvZGVjc3dpdGNoOiB0cnVlIGlmIGRpZmZlcmVudCBhdWRpbyBjb2RlY3MgdXNlZH1cbiAgTUFOSUZFU1RfUEFSU0VEICA6ICdobHNNYW5pZmVzdFBhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgbGV2ZWxJZCA6IGlkIG9mIGxldmVsIGJlaW5nIGxvYWRlZH1cbiAgTEVWRUxfTE9BRElORyAgICA6ICdobHNMZXZlbExvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBmaW5pc2hlcyAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsSWQgOiBpZCBvZiBsb2FkZWQgbGV2ZWwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9IH1cbiAgTEVWRUxfTE9BREVEIDogICdobHNMZXZlbExvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBzd2l0Y2ggaXMgcmVxdWVzdGVkIC0gZGF0YTogeyBsZXZlbElkIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIIDogICdobHNMZXZlbFN3aXRjaCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FESU5HIDogICdobHNGcmFnbWVudExvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEIDogICdobHNGcmFnbWVudExvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCA6ICAnaGxzRnJhZ21lbnRQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIG1vb2YvbWRhdCBoYXZlIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb2YgOiBtb29mIE1QNCBib3gsIG1kYXQgOiBtZGF0IE1QNCBib3h9XG4gIEZSQUdfUEFSU0lOR19EQVRBIDogICdobHNGcmFnbWVudFBhcnNpbmdEYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBwYXJzaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHVuZGVmaW5lZFxuICBGUkFHX1BBUlNFRCA6ICAnaGxzRnJhZ21lbnRQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHJlbXV4ZWQgTVA0IGJveGVzIGhhdmUgYWxsIGJlZW4gYXBwZW5kZWQgaW50byBTb3VyY2VCdWZmZXIgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgdHBhcnNlZCwgdGJ1ZmZlcmVkLCBsZW5ndGh9IH1cbiAgRlJBR19CVUZGRVJFRCA6ICAnaGxzRnJhZ21lbnRCdWZmZXJlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgbWF0Y2hpbmcgd2l0aCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uIGlzIGNoYW5naW5nIC0gZGF0YSA6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCB9XG4gIEZSQUdfQ0hBTkdFRCA6ICAnaGxzRnJhZ21lbnRDaGFuZ2VkJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9FUlJPUiA6ICAnaGxzRnJhZ0xvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9USU1FT1VUIDogICdobHNGcmFnTG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9FUlJPUiA6ICAnaGxzTGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQgOiAgJ2hsc0xldmVsTG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIHN3aXRjaCBlcnJvciAtIGRhdGE6IHsgbGV2ZWwgOiBmYXVsdHkgbGV2ZWwgSWQsIGV2ZW50IDogZXJyb3IgZGVzY3JpcHRpb259XG4gIExFVkVMX0VSUk9SIDogICdobHNMZXZlbEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1IgOiAgJ2hsc0ZyYWdtZW50UGFyc2luZ0Vycm9yJyxcbiAgICAvLyBJZGVudGlmaWVyIGZvciBhIGZyYWdtZW50IGFwcGVuZGluZyBlcnJvciBldmVudCAtIGRhdGE6IGFwcGVuZGluZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0FQUEVORElOR19FUlJPUiA6ICAnaGxzRnJhZ21lbnRBcHBlbmRpbmdFcnJvcidcbn07XG4iLCIvKipcbiAqIEhMUyBlbmdpbmVcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi9ldmVudHMnO1xuaW1wb3J0IFN0YXRzSGFuZGxlciAgICAgICAgIGZyb20gJy4vc3RhdHMnO1xuaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4vb2JzZXJ2ZXInO1xuaW1wb3J0IFBsYXlsaXN0TG9hZGVyICAgICAgIGZyb20gJy4vbG9hZGVyL3BsYXlsaXN0LWxvYWRlcic7XG5pbXBvcnQgQnVmZmVyQ29udHJvbGxlciAgICAgZnJvbSAnLi9jb250cm9sbGVyL2J1ZmZlci1jb250cm9sbGVyJztcbmltcG9ydCBMZXZlbENvbnRyb2xsZXIgICAgICBmcm9tICcuL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlcic7XG5pbXBvcnQge2xvZ2dlcixlbmFibGVMb2dzfSAgZnJvbSAnLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IFhockxvYWRlciAgICAgICAgICAgIGZyb20gJy4vdXRpbHMveGhyLWxvYWRlcic7XG4vL2ltcG9ydCBNUDRJbnNwZWN0ICAgICAgICAgZnJvbSAnL3JlbXV4L21wNC1pbnNwZWN0b3InO1xuXG5jbGFzcyBIbHMge1xuXG4gIHN0YXRpYyBpc1N1cHBvcnRlZCgpIHtcbiAgICByZXR1cm4gKHdpbmRvdy5NZWRpYVNvdXJjZSAmJiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSkge1xuICAgdmFyIGNvbmZpZ0RlZmF1bHQgPSB7XG4gICAgICBkZWJ1ZyA6IGZhbHNlLFxuICAgICAgbWF4QnVmZmVyTGVuZ3RoIDogMzAsXG4gICAgICBtYXhCdWZmZXJTaXplIDogNjAqMTAwMCoxMDAwLFxuICAgICAgZW5hYmxlV29ya2VyIDogdHJ1ZSxcbiAgICAgIGZyYWdMb2FkaW5nVGltZU91dCA6IDIwMDAwLFxuICAgICAgZnJhZ0xvYWRpbmdNYXhSZXRyeSA6IDYsXG4gICAgICBmcmFnTG9hZGluZ1JldHJ5RGVsYXkgOiA1MDAsXG4gICAgICBtYW5pZmVzdExvYWRpbmdUaW1lT3V0IDogMTAwMDAsXG4gICAgICBtYW5pZmVzdExvYWRpbmdNYXhSZXRyeSA6IDYsXG4gICAgICBtYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5IDogNTAwLFxuICAgICAgbG9hZGVyIDogWGhyTG9hZGVyXG4gICAgfTtcbiAgICBmb3IgKHZhciBwcm9wIGluIGNvbmZpZ0RlZmF1bHQpIHtcbiAgICAgICAgaWYgKHByb3AgaW4gY29uZmlnKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgIGNvbmZpZ1twcm9wXSA9IGNvbmZpZ0RlZmF1bHRbcHJvcF07XG4gICAgfVxuICAgIGVuYWJsZUxvZ3MoY29uZmlnLmRlYnVnKTtcblxuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBuZXcgUGxheWxpc3RMb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IG5ldyBMZXZlbENvbnRyb2xsZXIodGhpcy5wbGF5bGlzdExvYWRlcik7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyID0gbmV3IEJ1ZmZlckNvbnRyb2xsZXIodGhpcy5sZXZlbENvbnRyb2xsZXIsY29uZmlnKTtcbiAgICB0aGlzLnN0YXRzSGFuZGxlciA9IG5ldyBTdGF0c0hhbmRsZXIoY29uZmlnKTtcbiAgICB0aGlzLkV2ZW50cyA9IEV2ZW50O1xuICAgIC8vIG9ic2VydmVyIHNldHVwXG4gICAgdGhpcy5vbiA9IG9ic2VydmVyLm9uLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMub2ZmID0gb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIuYmluZChvYnNlcnZlcik7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmKHRoaXMucGxheWxpc3RMb2FkZXIpIHtcbiAgICAgIHRoaXMucGxheWxpc3RMb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMuYnVmZmVyQ29udHJvbGxlcikge1xuICAgICAgdGhpcy5idWZmZXJDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMubGV2ZWxDb250cm9sbGVyKSB7XG4gICAgICB0aGlzLmxldmVsQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudW5sb2FkU291cmNlKCk7XG4gICAgdGhpcy5kZXRhY2hWaWRlbygpO1xuICAgIG9ic2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICB9XG5cbiAgYXR0YWNoVmlkZW8odmlkZW8pIHtcbiAgICB0aGlzLnZpZGVvID0gdmlkZW87XG4gICAgdGhpcy5zdGF0c0hhbmRsZXIuYXR0YWNoVmlkZW8odmlkZW8pO1xuICAgIC8vIHNldHVwIHRoZSBtZWRpYSBzb3VyY2VcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlID0gbmV3IE1lZGlhU291cmNlKCk7XG4gICAgLy9NZWRpYSBTb3VyY2UgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25NZWRpYVNvdXJjZU9wZW4uYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1lZGlhU291cmNlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNjID0gdGhpcy5vbk1lZGlhU291cmNlQ2xvc2UuYmluZCh0aGlzKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgIHRoaXMub25tc28pO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAvLyBsaW5rIHZpZGVvIGFuZCBtZWRpYSBTb3VyY2VcbiAgICB2aWRlby5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG1zKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsdGhpcy5vbnZlcnJvcik7XG4gIH1cblxuICBkZXRhY2hWaWRlbygpIHtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHRoaXMuc3RhdHNIYW5kbGVyLmRldGFjaFZpZGVvKHZpZGVvKTtcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmKG1zKSB7XG4gICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB2aWRlby5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIGlmKHZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBsb2FkU291cmNlKHVybCkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIGxvZ2dlci5sb2coYGxvYWRTb3VyY2U6JHt1cmx9YCk7XG4gICAgLy8gd2hlbiBhdHRhY2hpbmcgdG8gYSBzb3VyY2UgVVJMLCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZFxuICAgIHRoaXMucGxheWxpc3RMb2FkZXIubG9hZCh1cmwsbnVsbCk7XG4gIH1cblxuICByZWNvdmVyRXJyb3IoKSB7XG4gICAgbG9nZ2VyLmxvZygndHJ5IHRvIHJlY292ZXIgZXJyb3InKTtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHRoaXMuZGV0YWNoVmlkZW8oKTtcbiAgICB0aGlzLmF0dGFjaFZpZGVvKHZpZGVvKTtcbiAgfVxuXG4gIHVubG9hZFNvdXJjZSgpIHtcbiAgICB0aGlzLnVybCA9IG51bGw7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgbmV4dCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBuZXh0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsICA9PT0gLTEpO1xuICB9XG5cbiAgLyogcmV0dXJuIG1hbnVhbCBsZXZlbCAqL1xuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsO1xuICB9XG5cblxuICAvKiByZXR1cm4gcGxheWJhY2sgc2Vzc2lvbiBzdGF0cyAqL1xuICBnZXQgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHNIYW5kbGVyLnN0YXRzO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NU0VfQVRUQUNIRUQsIHsgdmlkZW86IHRoaXMudmlkZW8sIG1lZGlhU291cmNlIDogdGhpcy5tZWRpYVNvdXJjZSB9KTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiIC8qXG4gKiBmcmFnbWVudCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuXG4gY2xhc3MgRnJhZ21lbnRMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnPWNvbmZpZztcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICBpZih0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKGZyYWcpIHtcbiAgICB0aGlzLmZyYWcgPSBmcmFnO1xuICAgIHRoaXMubG9hZGVyID0gbmV3IHRoaXMuY29uZmlnLmxvYWRlcigpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQoZnJhZy51cmwsJ2FycmF5YnVmZmVyJyx0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdUaW1lT3V0LCB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSk7XG4gIH1cblxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciBwYXlsb2FkID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZTtcbiAgICBzdGF0cy5sZW5ndGggPSBwYXlsb2FkLmJ5dGVMZW5ndGg7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgeyBwYXlsb2FkIDogcGF5bG9hZCxcbiAgICAgICAgICAgICAgICAgICAgICBmcmFnIDogdGhpcy5mcmFnICxcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9FUlJPUiwgeyB1cmwgOiB0aGlzLmZyYWcudXJsLCBldmVudDpldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9USU1FT1VULCB7IHVybCA6IHRoaXMuZnJhZy51cmx9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBGcmFnbWVudExvYWRlcjtcbiIsIi8qXG4gKiBwbGF5bGlzdCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuLy9pbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFBsYXlsaXN0TG9hZGVyIHtcblxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLm1hbmlmZXN0TG9hZGVkID0gZmFsc2U7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG4gIH1cblxuICBsb2FkKHVybCxyZXF1ZXN0SWQpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLmlkID0gcmVxdWVzdElkO1xuICAgIHRoaXMubG9hZGVyID0gbmV3IHRoaXMuY29uZmlnLmxvYWRlcigpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQodXJsLCcnLHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKSwgdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKSwgdGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aGlzLmNvbmZpZy5tYW5pZmVzdExvYWRpbmdUaW1lT3V0LCB0aGlzLmNvbmZpZy5tYW5pZmVzdExvYWRpbmdNYXhSZXRyeSx0aGlzLmNvbmZpZy5tYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5KTtcbiAgfVxuXG4gIHJlc29sdmUodXJsLCBiYXNlVXJsKSB7XG4gICAgdmFyIGRvYyAgICAgID0gZG9jdW1lbnQsXG4gICAgICAgIG9sZEJhc2UgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2Jhc2UnKVswXSxcbiAgICAgICAgb2xkSHJlZiA9IG9sZEJhc2UgJiYgb2xkQmFzZS5ocmVmLFxuICAgICAgICBkb2NIZWFkID0gZG9jLmhlYWQgfHwgZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF0sXG4gICAgICAgIG91ckJhc2UgPSBvbGRCYXNlIHx8IGRvY0hlYWQuYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ2Jhc2UnKSksXG4gICAgICAgIHJlc29sdmVyID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2EnKSxcbiAgICAgICAgcmVzb2x2ZWRVcmw7XG5cbiAgICBvdXJCYXNlLmhyZWYgPSBiYXNlVXJsO1xuICAgIHJlc29sdmVyLmhyZWYgPSB1cmw7XG4gICAgcmVzb2x2ZWRVcmwgID0gcmVzb2x2ZXIuaHJlZjsgLy8gYnJvd3NlciBtYWdpYyBhdCB3b3JrIGhlcmVcblxuICAgIGlmIChvbGRCYXNlKSB7b2xkQmFzZS5ocmVmID0gb2xkSHJlZjt9XG4gICAgZWxzZSB7ZG9jSGVhZC5yZW1vdmVDaGlsZChvdXJCYXNlKTt9XG4gICAgcmV0dXJuIHJlc29sdmVkVXJsO1xuICB9XG5cbiAgcGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsYmFzZXVybCkge1xuICAgIHZhciBsZXZlbHMgPSBbXSxsZXZlbCA9ICB7fSxyZXN1bHQsY29kZWNzLGNvZGVjO1xuICAgIHZhciByZSA9IC8jRVhULVgtU1RSRUFNLUlORjooW15cXG5cXHJdKihCQU5EKVdJRFRIPShcXGQrKSk/KFteXFxuXFxyXSooQ09ERUNTKT1cXFwiKC4qKVxcXCIsKT8oW15cXG5cXHJdKihSRVMpT0xVVElPTj0oXFxkKyl4KFxcZCspKT8oW15cXG5cXHJdKihOQU1FKT1cXFwiKC4qKVxcXCIpP1teXFxuXFxyXSpbXFxyXFxuXSsoW15cXHJcXG5dKykvZztcbiAgICB3aGlsZSgocmVzdWx0ID0gcmUuZXhlYyhzdHJpbmcpKSAhPSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKXsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpO30pO1xuICAgICAgbGV2ZWwudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdC5wb3AoKSxiYXNldXJsKTtcbiAgICAgIHdoaWxlKHJlc3VsdC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHN3aXRjaChyZXN1bHQuc2hpZnQoKSkge1xuICAgICAgICAgIGNhc2UgJ1JFUyc6XG4gICAgICAgICAgICBsZXZlbC53aWR0aCA9IHBhcnNlSW50KHJlc3VsdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIGxldmVsLmhlaWdodCA9IHBhcnNlSW50KHJlc3VsdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0JBTkQnOlxuICAgICAgICAgICAgbGV2ZWwuYml0cmF0ZSA9IHBhcnNlSW50KHJlc3VsdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ05BTUUnOlxuICAgICAgICAgICAgbGV2ZWwubmFtZSA9IHJlc3VsdC5zaGlmdCgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnQ09ERUNTJzpcbiAgICAgICAgICAgIGNvZGVjcyA9IHJlc3VsdC5zaGlmdCgpLnNwbGl0KCcsJyk7XG4gICAgICAgICAgICB3aGlsZShjb2RlY3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBjb2RlYyA9IGNvZGVjcy5zaGlmdCgpO1xuICAgICAgICAgICAgICBpZihjb2RlYy5pbmRleE9mKCdhdmMxJykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwudmlkZW9Db2RlYyA9IHRoaXMuYXZjMXRvYXZjb3RpKGNvZGVjKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXZlbC5hdWRpb0NvZGVjID0gY29kZWM7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgbGV2ZWwgPSB7fTtcbiAgICB9XG4gICAgcmV0dXJuIGxldmVscztcbiAgfVxuXG4gIGF2YzF0b2F2Y290aShjb2RlYykge1xuICAgIHZhciByZXN1bHQsYXZjZGF0YSA9IGNvZGVjLnNwbGl0KCcuJyk7XG4gICAgaWYoYXZjZGF0YS5sZW5ndGggPiAyKSB7XG4gICAgICByZXN1bHQgPSBhdmNkYXRhLnNoaWZ0KCkgKyAnLic7XG4gICAgICByZXN1bHQgKz0gcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNik7XG4gICAgICByZXN1bHQgKz0gKCcwMCcgKyBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC00KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gY29kZWM7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsLCBpZCkge1xuICAgIHZhciBjdXJyZW50U04gPSAwLHRvdGFsZHVyYXRpb24gPSAwLCBsZXZlbCA9IHsgdXJsIDogYmFzZXVybCwgZnJhZ21lbnRzIDogW10sIGxpdmUgOiB0cnVlfSwgcmVzdWx0LCByZWdleHA7XG4gICAgcmVnZXhwID0gLyg/OiNFWFQtWC0oTUVESUEtU0VRVUVOQ0UpOihcXGQrKSl8KD86I0VYVC1YLShUQVJHRVREVVJBVElPTik6KFxcZCspKXwoPzojRVhUKElORik6KFtcXGRcXC5dKylbXlxcclxcbl0qW1xcclxcbl0rKFteXFxyXFxuXSspfCg/OiNFWFQtWC0oRU5ETElTVCkpKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZWdleHAuZXhlYyhzdHJpbmcpKSAhPT0gbnVsbCl7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obil7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTt9KTtcbiAgICAgIHN3aXRjaChyZXN1bHRbMF0pIHtcbiAgICAgICAgY2FzZSAnTUVESUEtU0VRVUVOQ0UnOlxuICAgICAgICAgIGN1cnJlbnRTTiA9IGxldmVsLnN0YXJ0U04gPSBwYXJzZUludChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdUQVJHRVREVVJBVElPTic6XG4gICAgICAgICAgbGV2ZWwudGFyZ2V0ZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0VORExJU1QnOlxuICAgICAgICAgIGxldmVsLmxpdmUgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnSU5GJzpcbiAgICAgICAgICB2YXIgZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgbGV2ZWwuZnJhZ21lbnRzLnB1c2goe3VybCA6IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sYmFzZXVybCksIGR1cmF0aW9uIDogZHVyYXRpb24sIHN0YXJ0IDogdG90YWxkdXJhdGlvbiwgc24gOiBjdXJyZW50U04rKywgbGV2ZWw6aWR9KTtcbiAgICAgICAgICB0b3RhbGR1cmF0aW9uKz1kdXJhdGlvbjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmb3VuZCAnICsgbGV2ZWwuZnJhZ21lbnRzLmxlbmd0aCArICcgZnJhZ21lbnRzJyk7XG4gICAgbGV2ZWwudG90YWxkdXJhdGlvbiA9IHRvdGFsZHVyYXRpb247XG4gICAgbGV2ZWwuZW5kU04gPSBjdXJyZW50U04gLSAxO1xuICAgIHJldHVybiBsZXZlbDtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciBzdHJpbmcgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlVGV4dCwgdXJsID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVVSTCwgaWQgPSB0aGlzLmlkLGxldmVscztcbiAgICAvLyByZXNwb25zZVVSTCBub3Qgc3VwcG9ydGVkIG9uIHNvbWUgYnJvd3NlcnMgKGl0IGlzIHVzZWQgdG8gZGV0ZWN0IFVSTCByZWRpcmVjdGlvbilcbiAgICBpZih1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFsbGJhY2sgdG8gaW5pdGlhbCBVUkxcbiAgICAgIHVybCA9IHRoaXMudXJsO1xuICAgIH1cbiAgICBzdGF0cy50bG9hZCA9IG5ldyBEYXRlKCk7XG4gICAgc3RhdHMubXRpbWUgPSBuZXcgRGF0ZShldmVudC5jdXJyZW50VGFyZ2V0LmdldFJlc3BvbnNlSGVhZGVyKCdMYXN0LU1vZGlmaWVkJykpO1xuXG4gICAgaWYoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCBsZXZlbCB3aWxsIGJlIHJlbG9hZGVkIGFmdGVyd2FyZHNcbiAgICAgICAgLy8gKHRoaXMgaXMgdG8gaGF2ZSBhIHVuaWZvcm0gbG9naWMgZm9yIDEgbGV2ZWwvbXVsdGlsZXZlbCBwbGF5bGlzdHMpXG4gICAgICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiBbe3VybCA6IHVybH1dLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgZGV0YWlscyA6IHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZyx1cmwsaWQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsSWQgOiBpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVscyA9IHRoaXMucGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsdXJsKTtcbiAgICAgICAgLy8gbXVsdGkgbGV2ZWwgcGxheWxpc3QsIHBhcnNlIGxldmVsIGluZm9cbiAgICAgICAgaWYobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxldmVscyA6IGxldmVscyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiB1cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQgOiBpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX0VSUk9SLCB7IHVybCA6IHVybCwgcmVzcG9uc2UgOiAnbm8gbGV2ZWwgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX0VSUk9SLCB7IHVybCA6IHVybCwgcmVzcG9uc2UgOiBldmVudC5jdXJyZW50VGFyZ2V0fSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FEX0VSUk9SLCB7IHVybCA6IHRoaXMudXJsLCByZXNwb25zZSA6IGV2ZW50LmN1cnJlbnRUYXJnZXR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FEX1RJTUVPVVQsIHsgdXJsIDogdGhpcy51cmx9KTtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFBsYXlsaXN0TG9hZGVyO1xuIiwiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuXG5sZXQgb2JzZXJ2ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5cbm9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBvYnNlcnZlcjtcbiIsIi8qKlxuICogZ2VuZXJhdGUgTVA0IEJveFxuICovXG5cbmNsYXNzIE1QNCB7XG4gIHN0YXRpYyBpbml0KCkge1xuICAgIE1QNC50eXBlcyA9IHtcbiAgICAgIGF2YzE6IFtdLCAvLyBjb2RpbmduYW1lXG4gICAgICBhdmNDOiBbXSxcbiAgICAgIGJ0cnQ6IFtdLFxuICAgICAgZGluZjogW10sXG4gICAgICBkcmVmOiBbXSxcbiAgICAgIGVzZHM6IFtdLFxuICAgICAgZnR5cDogW10sXG4gICAgICBoZGxyOiBbXSxcbiAgICAgIG1kYXQ6IFtdLFxuICAgICAgbWRoZDogW10sXG4gICAgICBtZGlhOiBbXSxcbiAgICAgIG1maGQ6IFtdLFxuICAgICAgbWluZjogW10sXG4gICAgICBtb29mOiBbXSxcbiAgICAgIG1vb3Y6IFtdLFxuICAgICAgbXA0YTogW10sXG4gICAgICBtdmV4OiBbXSxcbiAgICAgIG12aGQ6IFtdLFxuICAgICAgc2R0cDogW10sXG4gICAgICBzdGJsOiBbXSxcbiAgICAgIHN0Y286IFtdLFxuICAgICAgc3RzYzogW10sXG4gICAgICBzdHNkOiBbXSxcbiAgICAgIHN0c3o6IFtdLFxuICAgICAgc3R0czogW10sXG4gICAgICB0ZmR0OiBbXSxcbiAgICAgIHRmaGQ6IFtdLFxuICAgICAgdHJhZjogW10sXG4gICAgICB0cmFrOiBbXSxcbiAgICAgIHRydW46IFtdLFxuICAgICAgdHJleDogW10sXG4gICAgICB0a2hkOiBbXSxcbiAgICAgIHZtaGQ6IFtdLFxuICAgICAgc21oZDogW11cbiAgICB9O1xuXG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIE1QNC50eXBlcykge1xuICAgICAgaWYgKE1QNC50eXBlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBNUDQudHlwZXNbaV0gPSBbXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDApLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgxKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMiksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDMpXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgTVA0Lk1BSk9SX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2knLmNoYXJDb2RlQXQoMCksXG4gICAgICAncycuY2hhckNvZGVBdCgwKSxcbiAgICAgICdvJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ20nLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuQVZDMV9CUkFORCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICdhJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ3YnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnYycuY2hhckNvZGVBdCgwKSxcbiAgICAgICcxJy5jaGFyQ29kZUF0KDApXG4gICAgXSk7XG4gICAgTVA0Lk1JTk9SX1ZFUlNJT04gPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMV0pO1xuICAgIE1QNC5WSURFT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuQVVESU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOk1QNC5WSURFT19IRExSLFxuICAgICAgJ2F1ZGlvJzpNUDQuQVVESU9fSERMUlxuICAgIH07XG4gICAgTVA0LkRSRUYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG4gICAgTVA0LlNUQ08gPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCAvLyBlbnRyeV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5TVFNDID0gTVA0LlNUQ087XG4gICAgTVA0LlNUVFMgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIE1QNC5NQUpPUl9CUkFORCwgTVA0Lk1JTk9SX1ZFUlNJT04sIE1QNC5NQUpPUl9CUkFORCwgTVA0LkFWQzFfQlJBTkQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgTVA0LkRSRUYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gMCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgcmVzdWx0LFxuICAgIHZpZXc7XG5cbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShzaXplICsgOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhyZXN1bHQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLCByZXN1bHQuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcblxuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBwYXlsb2FkLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZChkdXJhdGlvbikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAzLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMSwgMHg1ZiwgMHg5MCwgLy8gdGltZXNjYWxlLCA5MCwwMDAgXCJ0aWNrc1wiIHBlciBzZWNvbmRcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMjQpLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gIDgpICYgMHhGRixcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnNtaGQsIE1QNC5TTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy52bWhkLCBNUDQuVk1IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBtb29mKHNuLCBiYXNlTWVkaWFEZWNvZGVUaW1lLCB0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tb29mLFxuICAgICAgICAgICAgICAgICAgIE1QNC5tZmhkKHNuKSxcbiAgICAgICAgICAgICAgICAgICBNUDQudHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSk7XG4gIH1cbi8qKlxuICogQHBhcmFtIHRyYWNrcy4uLiAob3B0aW9uYWwpIHthcnJheX0gdGhlIHRyYWNrcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBtb3ZpZVxuICovXG4gIHN0YXRpYyBtb292KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJhayh0cmFja3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubW9vdiwgTVA0Lm12aGQodHJhY2tzWzBdLmR1cmF0aW9uKV0uY29uY2F0KGJveGVzKS5jb25jYXQoTVA0Lm12ZXgodHJhY2tzKSkpO1xuICB9XG5cbiAgc3RhdGljIG12ZXgodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmV4KHRyYWNrc1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubXZleF0uY29uY2F0KGJveGVzKSk7XG4gIH1cblxuICBzdGF0aWMgbXZoZChkdXJhdGlvbikge1xuICAgIHZhclxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4NWYsIDB4OTAsIC8vIHRpbWVzY2FsZSwgOTAsMDAwIFwidGlja3NcIiBwZXIgc2Vjb25kXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLCAvLyAxLjAgcmF0ZVxuICAgICAgICAweDAxLCAweDAwLCAvLyAxLjAgdm9sdW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHhmZiwgMHhmZiwgMHhmZiwgMHhmZiAvLyBuZXh0X3RyYWNrX0lEXG4gICAgICBdKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXZoZCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHNkdHAodHJhY2spIHtcbiAgICB2YXJcbiAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheSg0ICsgc2FtcGxlcy5sZW5ndGgpLFxuICAgICAgZmxhZ3MsXG4gICAgICBpO1xuXG4gICAgLy8gbGVhdmUgdGhlIGZ1bGwgYm94IGhlYWRlciAoNCBieXRlcykgYWxsIHplcm9cblxuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzW2ldLmZsYWdzO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKGZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsXG4gICAgICAgICAgICAgICBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc3RibCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdGJsLFxuICAgICAgICAgICAgICAgTVA0LnN0c2QodHJhY2spLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RzYywgTVA0LlNUU0MpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RzeiwgTVA0LlNUU1opLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaTtcbiAgICAvLyBhc3NlbWJsZSB0aGUgU1BTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5zcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNwcy5wdXNoKCh0cmFjay5zcHNbaV0uYnl0ZUxlbmd0aCA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHNwcy5wdXNoKCh0cmFjay5zcHNbaV0uYnl0ZUxlbmd0aCAmIDB4RkYpKTsgLy8gc2VxdWVuY2VQYXJhbWV0ZXJTZXRMZW5ndGhcbiAgICAgIHNwcyA9IHNwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodHJhY2suc3BzW2ldKSk7IC8vIFNQU1xuICAgIH1cblxuICAgIC8vIGFzc2VtYmxlIHRoZSBQUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnBwcy5sZW5ndGg7IGkrKykge1xuICAgICAgcHBzLnB1c2goKHRyYWNrLnBwc1tpXS5ieXRlTGVuZ3RoID4+PiA4KSAmIDB4RkYpO1xuICAgICAgcHBzLnB1c2goKHRyYWNrLnBwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpO1xuICAgICAgcHBzID0gcHBzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5wcHNbaV0pKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuYXZjMSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAodHJhY2sud2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgICB0cmFjay53aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAgICh0cmFjay5oZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgICB0cmFjay5oZWlnaHQgJiAweGZmLCAvLyBoZWlnaHRcbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gaG9yaXpyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGZyYW1lX2NvdW50XG4gICAgICAgIDB4MTMsXG4gICAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAgIDB4NmYsIDB4NmEsIDB4NzMsIDB4MmQsXG4gICAgICAgIDB4NjMsIDB4NmYsIDB4NmUsIDB4NzQsXG4gICAgICAgIDB4NzIsIDB4NjksIDB4NjIsIDB4MmQsXG4gICAgICAgIDB4NjgsIDB4NmMsIDB4NzMsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNvbXByZXNzb3JuYW1lXG4gICAgICAgIDB4MDAsIDB4MTgsIC8vIGRlcHRoID0gMjRcbiAgICAgICAgMHgxMSwgMHgxMV0pLCAvLyBwcmVfZGVmaW5lZCA9IC0xXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYXZjQywgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMSwgLy8gY29uZmlndXJhdGlvblZlcnNpb25cbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVJZGMsIC8vIEFWQ1Byb2ZpbGVJbmRpY2F0aW9uXG4gICAgICAgICAgICB0cmFjay5wcm9maWxlQ29tcGF0aWJpbGl0eSwgLy8gcHJvZmlsZV9jb21wYXRpYmlsaXR5XG4gICAgICAgICAgICB0cmFjay5sZXZlbElkYywgLy8gQVZDTGV2ZWxJbmRpY2F0aW9uXG4gICAgICAgICAgICAweGZmIC8vIGxlbmd0aFNpemVNaW51c09uZSwgaGFyZC1jb2RlZCB0byA0IGJ5dGVzXG4gICAgICAgICAgXS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2suc3BzLmxlbmd0aCAvLyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChzcHMpLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5wcHMubGVuZ3RoIC8vIG51bU9mUGljdHVyZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQocHBzKSkpLCAvLyBcIlBQU1wiXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrdHJhY2suY29uZmlnLmxlbmd0aCwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK3RyYWNrLmNvbmZpZy5sZW5ndGgsIC8vIGxlbmd0aFxuICAgICAgMHg0MCwgLy9jb2RlYyA6IG1wZWc0X2F1ZGlvXG4gICAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYnVmZmVyX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1heEJpdHJhdGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgICAgMHgwNSAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIF0uY29uY2F0KFt0cmFjay5jb25maWcubGVuZ3RoXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgICAgKHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQubXA0YSh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQuYXZjMSh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB0a2hkKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRraGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwNywgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodHJhY2suaWQgPj4gMjQpICYgMHhGRixcbiAgICAgICh0cmFjay5pZCA+PiAxNikgJiAweEZGLFxuICAgICAgKHRyYWNrLmlkID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmlkICYgMHhGRiwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbGF5ZXJcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGFsdGVybmF0ZV9ncm91cFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbm9uLWF1ZGlvIHRyYWNrIHZvbHVtZVxuICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgKHRyYWNrLndpZHRoID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLndpZHRoICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHdpZHRoXG4gICAgICAodHJhY2suaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmhlaWdodCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwIC8vIGhlaWdodFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpIHtcbiAgICB2YXIgc2FtcGxlRGVwZW5kZW5jeVRhYmxlID0gTVA0LnNkdHAodHJhY2spO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFmLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDI0KSxcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYpIC8vIHRyYWNrX0lEXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmR0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PjI0KSxcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYpIC8vIGJhc2VNZWRpYURlY29kZVRpbWVcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC50cnVuKHRyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmhkXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZkdFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIHRyYWYgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gbWZoZFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIG1vb2YgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDgpLCAgLy8gbWRhdCBoZWFkZXJcbiAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZSk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSB0cmFjayBib3guXG4gICAqIEBwYXJhbSB0cmFjayB7b2JqZWN0fSBhIHRyYWNrIGRlZmluaXRpb25cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIHRyYWNrIGJveFxuICAgKi9cbiAgc3RhdGljIHRyYWsodHJhY2spIHtcbiAgICB0cmFjay5kdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uIHx8IDB4ZmZmZmZmZmY7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWssXG4gICAgICAgICAgICAgICBNUDQudGtoZCh0cmFjayksXG4gICAgICAgICAgICAgICBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAodHJhY2suaWQgPj4gMjQpLFxuICAgICAodHJhY2suaWQgPj4gMTYpICYgMFhGRixcbiAgICAgKHRyYWNrLmlkID4+IDgpICYgMFhGRixcbiAgICAgKHRyYWNrLmlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIHNhbXBsZXMsIHNhbXBsZSwgaSwgYXJyYXk7XG5cbiAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXTtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KDEyICsgKDE2ICogc2FtcGxlcy5sZW5ndGgpKTtcbiAgICBvZmZzZXQgKz0gOCArIGFycmF5LmJ5dGVMZW5ndGg7XG5cbiAgICBhcnJheS5zZXQoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDBmLCAweDAxLCAvLyBmbGFnc1xuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiAyNCkgJiAweEZGLFxuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiAxNikgJiAweEZGLFxuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiA4KSAmIDB4RkYsXG4gICAgICBzYW1wbGVzLmxlbmd0aCAmIDB4RkYsIC8vIHNhbXBsZV9jb3VudFxuICAgICAgKG9mZnNldCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiA4KSAmIDB4RkYsXG4gICAgICBvZmZzZXQgJiAweEZGIC8vIGRhdGFfb2Zmc2V0XG4gICAgXSwwKTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzYW1wbGUgPSBzYW1wbGVzW2ldO1xuICAgICAgYXJyYXkuc2V0KFtcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuZHVyYXRpb24gJiAweEZGLCAvLyBzYW1wbGVfZHVyYXRpb25cbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuc2l6ZSAmIDB4RkYsIC8vIHNhbXBsZV9zaXplXG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgc2FtcGxlLmZsYWdzLmRlcGVuZHNPbixcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAgIChzYW1wbGUuZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKHNhbXBsZS5mbGFncy5wYWRkaW5nVmFsdWUgPDwgMSkgfFxuICAgICAgICAgIHNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUsXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRhdGlvblByaW9yaXR5ICYgMHhGMCA8PCA4LFxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkYXRpb25Qcmlvcml0eSAmIDB4MEYsIC8vIHNhbXBsZV9mbGFnc1xuICAgICAgICAoc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgICAgXSwxMisxNippKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRydW4sIGFycmF5KTtcbiAgfVxuXG4gIHN0YXRpYyBpbml0U2VnbWVudCh0cmFja3MpIHtcblxuICAgIGlmKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhclxuICAgICAgbW92aWUgPSBNUDQubW9vdih0cmFja3MpLFxuICAgICAgcmVzdWx0O1xuXG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoTVA0LkZUWVAuYnl0ZUxlbmd0aCArIG1vdmllLmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQoTVA0LkZUWVApO1xuICAgIHJlc3VsdC5zZXQobW92aWUsIE1QNC5GVFlQLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuXG5cbiIsIiAvKlxuICogU3RhdHMgSGFuZGxlclxuICpcbiAqL1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi9ldmVudHMnO1xuaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4vb2JzZXJ2ZXInO1xuXG4gY2xhc3MgU3RhdHNIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcbiAgICB0aGlzLmNvbmZpZz1jb25maWc7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgYXR0YWNoVmlkZW8odmlkZW8pIHtcbiAgICB0aGlzLnZpZGVvID0gdmlkZW87XG5cbiAgfVxuXG4gIGRldGFjaFZpZGVvKCkge1xuICAgIHRoaXMudmlkZW8gPSBudWxsO1xuICB9XG5cbiAgZ2V0IHN0YXRzKCkge1xuICAgIHJldHVybiB7dGVjaCA6ICdobHMuanMnfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTdGF0c0hhbmRsZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vb3AoKXt9XG5sZXQgZmFrZUxvZ2dlciA9IHtcbiAgbG9nOiBub29wLFxuICB3YXJuOiBub29wLFxuICBpbmZvOiBub29wLFxuICBlcnJvcjogbm9vcFxufTtcbmxldCBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG5cbmV4cG9ydCB2YXIgZW5hYmxlTG9ncyA9IGZ1bmN0aW9uKGRlYnVnKSB7XG4gIGlmIChkZWJ1ZyA9PT0gdHJ1ZSB8fCB0eXBlb2YgZGVidWcgICAgICAgPT09ICdvYmplY3QnKSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIubG9nICAgPSBkZWJ1Zy5sb2cgICA/IGRlYnVnLmxvZy5iaW5kKGRlYnVnKSAgIDogY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci5pbmZvICA9IGRlYnVnLmluZm8gID8gZGVidWcuaW5mby5iaW5kKGRlYnVnKSAgOiBjb25zb2xlLmluZm8uYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci5lcnJvciA9IGRlYnVnLmVycm9yID8gZGVidWcuZXJyb3IuYmluZChkZWJ1ZykgOiBjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIud2FybiAgPSBkZWJ1Zy53YXJuICA/IGRlYnVnLndhcm4uYmluZChkZWJ1ZykgIDogY29uc29sZS53YXJuLmJpbmQoY29uc29sZSk7XG5cbiAgICAvLyBTb21lIGJyb3dzZXJzIGRvbid0IGFsbG93IHRvIHVzZSBiaW5kIG9uIGNvbnNvbGUgb2JqZWN0IGFueXdheVxuICAgIC8vIGZhbGxiYWNrIHRvIGRlZmF1bHQgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgZXhwb3J0ZWRMb2dnZXIubG9nKCk7XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICBleHBvcnRlZExvZ2dlci5sb2cgICA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci5pbmZvICA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci5lcnJvciA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci53YXJuICA9IG5vb3A7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgfVxufTtcbmV4cG9ydCB2YXIgbG9nZ2VyID0gZXhwb3J0ZWRMb2dnZXI7XG4iLCIgLypcbiAgKiBYaHIgYmFzZWQgTG9hZGVyXG4gICpcbiAgKi9cblxuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbiBjbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmFib3J0KCk7XG4gICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICB9XG5cbiAgYWJvcnQoKSB7XG4gICAgaWYodGhpcy5sb2FkZXIgJiZ0aGlzLmxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICBpZih0aGlzLnRpbWVvdXRIYW5kbGUpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKHVybCxyZXNwb25zZVR5cGUsb25TdWNjZXNzLG9uRXJyb3Isb25UaW1lb3V0LHRpbWVvdXQsbWF4UmV0cnkscmV0cnlEZWxheSkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuICAgIHRoaXMub25TdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy50cmVxdWVzdCA9IG5ldyBEYXRlKCk7XG4gICAgdGhpcy50aW1lb3V0ID0gdGltZW91dDtcbiAgICB0aGlzLm1heFJldHJ5ID0gbWF4UmV0cnk7XG4gICAgdGhpcy5yZXRyeURlbGF5ID0gcmV0cnlEZWxheTtcbiAgICB0aGlzLnJldHJ5ID0gMDtcbiAgICB0aGlzLnRpbWVvdXRIYW5kbGUgPSB3aW5kb3cuc2V0VGltZW91dCh0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksdGltZW91dCk7XG4gICAgdGhpcy5sb2FkSW50ZXJuYWwoKTtcbiAgfVxuXG4gIGxvYWRJbnRlcm5hbCgpIHtcbiAgICB2YXIgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkID0gIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub25lcnJvciA9IHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vcGVuKCdHRVQnLCB0aGlzLnVybCAsIHRydWUpO1xuICAgIHhoci5yZXNwb25zZVR5cGUgPSB0aGlzLnJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLnRmaXJzdCA9IG51bGw7XG4gICAgdGhpcy5sb2FkZWQgPSAwO1xuICAgIHhoci5zZW5kKCk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICB0aGlzLm9uU3VjY2VzcyhldmVudCx7dHJlcXVlc3QgOiB0aGlzLnRyZXF1ZXN0LCB0Zmlyc3QgOiB0aGlzLnRmaXJzdCwgdGxvYWQgOiBuZXcgRGF0ZSgpLCBsb2FkZWQgOiB0aGlzLmxvYWRlZH0pO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgaWYodGhpcy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgIGxvZ2dlci5sb2coYCR7ZXZlbnQudHlwZX0gd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfSwgcmV0cnlpbmcgaW4gJHt0aGlzLnJldHJ5RGVsYXl9Li4uYCk7XG4gICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksdGhpcy5yZXRyeURlbGF5KTtcbiAgICAgIC8vIGV4cG9uZW50aWFsIGJhY2tvZmZcbiAgICAgIHRoaXMucmV0cnlEZWxheT1NYXRoLm1pbigyKnRoaXMucmV0cnlEZWxheSw2NDAwMCk7XG4gICAgICB0aGlzLnJldHJ5Kys7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgIGxvZ2dlci5sb2coYCR7ZXZlbnQudHlwZX0gd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfWAgKTtcbiAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgfVxuICB9XG5cbiAgbG9hZHRpbWVvdXQoZXZlbnQpIHtcbiAgICBsb2dnZXIubG9nKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQse3RyZXF1ZXN0IDogdGhpcy50cmVxdWVzdCwgdGZpcnN0IDogdGhpcy50Zmlyc3QsIGxvYWRlZCA6IHRoaXMubG9hZGVkfSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQpIHtcbiAgICBpZih0aGlzLnRmaXJzdCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy50Zmlyc3QgPSBuZXcgRGF0ZSgpO1xuICAgIH1cbiAgICBpZihldmVudC5sZW5ndGhDb21wdXRhYmxlKSB7XG4gICAgICB0aGlzLmxvYWRlZCA9IGV2ZW50LmxvYWRlZDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgWGhyTG9hZGVyO1xuIl19
