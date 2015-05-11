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
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
 * buffer controller
 *
 */

var Event = _interopRequire(require("../events"));

var FragmentLoader = _interopRequire(require("../loader/fragment-loader"));

var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var Demuxer = _interopRequire(require("../demux/demuxer"));

var STARTING = -1;
var IDLE = 0;
var LOADING = 1;
var WAITING_LEVEL = 2;
var PARSING = 3;
var PARSED = 4;
var APPENDING = 5;
var BUFFER_FLUSHING = 6;

var BufferController = (function () {
  function BufferController(levelController) {
    this.levelController = levelController;
    this.fragmentLoader = new FragmentLoader();
    this.mp4segments = [];
    this.bufferRange = [];
    this.flushRange = [];
    this.flushBufferCounter = 0;
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
    this.ontick = this.tick.bind(this);
    observer.on(Event.MSE_ATTACHED, this.onmse);
    observer.on(Event.MANIFEST_PARSED, this.onmp);
    this.demuxer = new Demuxer();
  }

  _prototypeProperties(BufferController, null, {
    destroy: {
      value: function destroy() {
        this.stop();
        this.fragmentLoader.destroy();
        if (this.demuxer) {
          this.demuxer.destroy();
          this.demuxer = null;
        }
        this.mp4segments = [];
        this.bufferRange = [];
        this.flushRange = [];
        var sb = this.sourceBuffer;
        if (sb) {
          if (sb.audio) {
            //detach sourcebuffer from Media Source
            this.mediaSource.removeSourceBuffer(sb.audio);
            sb.audio.removeEventListener("updateend", this.onsbue);
            sb.audio.removeEventListener("error", this.onsbe);
          }
          if (sb.video) {
            //detach sourcebuffer from Media Source
            this.mediaSource.removeSourceBuffer(sb.video);
            sb.video.removeEventListener("updateend", this.onsbue);
            sb.video.removeEventListener("error", this.onsbe);
          }
          this.sourceBuffer = null;
        }
        observer.removeListener(Event.MANIFEST_PARSED, this.onmp);
        // remove video listener
        if (this.video) {
          this.video.removeEventListener("seeking", this.onvseeking);
          this.video.removeEventListener("seeked", this.onvseeked);
          this.video.removeEventListener("loadedmetadata", this.onvmetadata);
          this.onvseeking = this.onvseeked = this.onvmetadata = null;
        }

        this.state = IDLE;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    start: {
      value: function start() {
        this.stop();
        this.timer = setInterval(this.ontick, 100);
        observer.on(Event.FRAG_LOADED, this.onfl);
        observer.on(Event.FRAG_PARSING_INIT_SEGMENT, this.onis);
        observer.on(Event.FRAG_PARSING_DATA, this.onfpg);
        observer.on(Event.FRAG_PARSED, this.onfp);
        observer.on(Event.LEVEL_LOADED, this.onll);
        this.state = STARTING;
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stop: {
      value: function stop() {
        if (this.timer) {
          clearInterval(this.timer);
        }
        this.timer = undefined;
        observer.removeListener(Event.FRAG_LOADED, this.onfl);
        observer.removeListener(Event.FRAG_PARSED, this.onfp);
        observer.removeListener(Event.FRAG_PARSING_DATA, this.onfpg);
        observer.removeListener(Event.LEVEL_LOADED, this.onll);
        observer.removeListener(Event.FRAG_PARSING_INIT_SEGMENT, this.onis);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    tick: {
      value: function tick() {
        var pos, loadLevel, loadLevelDetails, fragIdx;
        switch (this.state) {
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
                bufferEnd = bufferInfo.end;
            // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
            var maxBufLen = Math.min(8 * 60 * 1000 * 1000 / this.levels[loadLevel].bitrate, 30);
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
              if (typeof loadLevelDetails === "undefined") {
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
                logger.log("requested position:" + bufferEnd + " is before start of playlist, reset video position to start:" + start);
                this.video.currentTime = start + 0.01;
                break;
              }
              //look for fragments matching with current play position
              for (fragIdx = 0; fragIdx < fragments.length; fragIdx++) {
                frag = fragments[fragIdx];
                start = frag.start + sliding;
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
                    logger.log("SN just loaded, load next one:" + frag.sn);
                  }
                }
                logger.log("Loading       " + frag.sn + " of [" + fragments[0].sn + "," + fragments[fragments.length - 1].sn + "],level " + loadLevel);
                //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));

                this.frag = frag;
                this.level = loadLevel;
                this.fragmentLoader.load(frag, loadLevel);
                this.state = LOADING;
              }
            }
            break;
          case LOADING:
          // nothing to do, wait for fragment retrieval
          case WAITING_LEVEL:
          // nothing to do, wait for level retrieval
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
                  this.sourceBuffer[segment.type].appendBuffer(segment.data);
                } catch (err) {
                  // in case any error occured while appending, put back segment in mp4segments table
                  logger.log("error while trying to append buffer, buffer might be full, try appending later");
                  this.mp4segments.unshift(segment);
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    bufferInfo: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    getBufferRange: {
      value: function getBufferRange(position) {
        var i, range;
        for (i = this.bufferRange.length - 1; i >= 0; i--) {
          range = this.bufferRange[i];
          if (position >= range.start && position <= range.end) {
            return range;
          }
        }
        return null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    currentLevel: {
      get: function () {
        if (this.video) {
          var range = this.getBufferRange(this.video.currentTime);
          if (range) {
            return range.frag.level;
          }
        }
        return -1;
      },
      enumerable: true,
      configurable: true
    },
    nextBufferRange: {
      get: function () {
        if (this.video) {
          // first get end range of current fragment
          return this.followingBufferRange(this.getBufferRange(this.video.currentTime));
        } else {
          return null;
        }
      },
      enumerable: true,
      configurable: true
    },
    followingBufferRange: {
      value: function followingBufferRange(range) {
        if (range) {
          // try to get range of next fragment (500ms after this range)
          return this.getBufferRange(range.end + 0.5);
        }
        return null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    nextLevel: {
      get: function () {
        var range = this.nextBufferRange;
        if (range) {
          return range.frag.level;
        } else {
          return -1;
        }
      },
      enumerable: true,
      configurable: true
    },
    isBuffered: {
      value: function isBuffered(position) {
        var v = this.video,
            buffered = v.buffered;
        for (var i = 0; i < buffered.length; i++) {
          if (position >= buffered.start(i) && position <= buffered.end(i)) {
            return true;
          }
        }
        return false;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _checkFragmentChanged: {
      value: function CheckFragmentChanged() {
        var rangeCurrent;
        if (this.video && this.video.seeking === false && this.isBuffered(this.video.currentTime)) {
          rangeCurrent = this.getBufferRange(this.video.currentTime);
        }

        if (rangeCurrent && rangeCurrent.frag !== this.fragCurrent) {
          this.fragCurrent = rangeCurrent.frag;
          observer.trigger(Event.FRAG_CHANGED, { frag: this.fragCurrent });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    flushBuffer: {

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
                flushStart = Math.max(bufStart, startOffset);
                flushEnd = Math.min(bufEnd, endOffset);
                /* sometimes sourcebuffer.remove() does not flush
                   the exact expected time range.
                   to avoid rounding issues/infinite loop,
                   only flush buffer range of length greater than 500ms.
                */
                if (flushEnd - flushStart > 0.5) {
                  logger.log("flush " + type + " [" + flushStart + "," + flushEnd + "], of [" + bufStart + "," + bufEnd + "], pos:" + this.video.currentTime);
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

        logger.log("buffer flushed");
        // everything flushed !
        return true;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    immediateLevelSwitch: {

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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    immediateLevelSwitchEnd: {

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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    nextLevelSwitch: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onMSEAttached: {
      value: function onMSEAttached(event, data) {
        this.video = data.video;
        this.mediaSource = data.mediaSource;
        this.onvseeking = this.onVideoSeeking.bind(this);
        this.onvseeked = this.onVideoSeeked.bind(this);
        this.onvmetadata = this.onVideoMetadata.bind(this);
        this.video.addEventListener("seeking", this.onvseeking);
        this.video.addEventListener("seeked", this.onvseeked);
        this.video.addEventListener("loadedmetadata", this.onvmetadata);
        if (this.levels) {
          this.start();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onVideoSeeking: {
      value: function onVideoSeeking() {
        if (this.state === LOADING) {
          // check if currently loaded fragment is inside buffer.
          //if outside, cancel fragment loading, otherwise do nothing
          if (this.bufferInfo(this.video.currentTime).len === 0) {
            logger.log("seeking outside of buffer while fragment load in progress, cancel fragment load");
            this.fragmentLoader.abort();
            this.state = IDLE;
          }
        }
        // tick to speed up processing
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onVideoSeeked: {
      value: function onVideoSeeked() {
        // tick to speed up FRAGMENT_PLAYING triggering
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onVideoMetadata: {
      value: function onVideoMetadata() {
        if (this.video.currentTime !== this.startPosition) {
          this.video.currentTime = this.startPosition;
        }
        this.loadedmetadata = true;
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onManifestParsed: {
      value: function onManifestParsed(event, data) {
        this.audiocodecswitch = data.audiocodecswitch;
        if (this.audiocodecswitch) {
          logger.log("both AAC/HE-AAC audio found in levels; declaring audio codec as HE-AAC");
        }
        this.levels = data.levels;
        this.startLevelLoaded = false;
        this.startFragmentLoaded = false;
        if (this.video) {
          this.start();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onLevelLoaded: {
      value: function onLevelLoaded(event, data) {
        var fragments = data.details.fragments,
            duration = data.details.totalduration;
        logger.log("level " + data.levelId + " loaded [" + fragments[0].sn + "," + fragments[fragments.length - 1].sn + "],duration:" + duration);

        var level = this.levels[data.levelId],
            sliding = 0,
            levelCurrent = this.levels[this.level];
        // check if playlist is already loaded (if yes, it should be a live playlist)
        if (levelCurrent && levelCurrent.details && levelCurrent.details.live) {
          //  playlist sliding is the sum of : current playlist sliding + sliding of new playlist compared to current one
          sliding = levelCurrent.details.sliding;
          // check sliding of updated playlist against current one :
          // and find its position in current playlist
          //logger.log("fragments[0].sn/this.level/levelCurrent.details.fragments[0].sn:" + fragments[0].sn + "/" + this.level + "/" + levelCurrent.details.fragments[0].sn);
          var SNdiff = fragments[0].sn - levelCurrent.details.fragments[0].sn;
          if (SNdiff >= 0) {
            // positive sliding : new playlist sliding window is after previous one
            sliding += levelCurrent.details.fragments[SNdiff].start;
          } else {
            // negative sliding: new playlist sliding window is before previous one
            sliding -= fragments[-SNdiff].start;
          }
          logger.log("live playlist sliding:" + sliding.toFixed(3));
        }
        // override level info
        level.details = data.details;
        level.details.sliding = sliding;
        this.demuxer.setDuration(duration);
        if (this.startLevelLoaded === false) {
          // if live playlist, set start position to be fragment N-3
          if (data.details.live) {
            this.startPosition = Math.max(0, duration - 3 * data.details.targetduration);
          } else {
            this.startPosition = 0;
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onFragmentLoaded: {
      value: function onFragmentLoaded(event, data) {
        if (this.state === LOADING) {
          if (this.fragmentBitrateTest === true) {
            // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
            this.state = IDLE;
            this.fragmentBitrateTest = false;
            data.stats.tparsed = data.stats.tbuffered = new Date();
            observer.trigger(Event.FRAG_BUFFERED, { stats: data.stats, frag: this.frag });
            this.frag = null;
          } else {
            this.state = PARSING;
            // transmux the MPEG-TS data to ISO-BMFF segments
            this.stats = data.stats;
            this.demuxer.push(data.payload, this.levels[this.level].audioCodec, this.levels[this.level].videoCodec, this.frag.start);
          }
          this.startFragmentLoaded = true;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onInitSegment: {
      value: function onInitSegment(event, data) {
        // check if codecs have been explicitely defined in the master playlist for this level;
        // if yes use these ones instead of the ones parsed from the demux
        var audioCodec = this.levels[this.level].audioCodec,
            videoCodec = this.levels[this.level].videoCodec,
            sb;
        //logger.log('playlist level A/V codecs:' + audioCodec + ',' + videoCodec);
        //logger.log('playlist codecs:' + codec);
        // if playlist does not specify codecs, use codecs found while parsing fragment
        if (audioCodec === undefined) {
          audioCodec = data.audioCodec;
        }
        if (videoCodec === undefined) {
          videoCodec = data.videoCodec;
        }

        // codec="mp4a.40.5,avc1.420016";
        // in case several audio codecs might be used, force HE-AAC for audio (some browsers don't support audio codec switch)
        //don't do it for mono streams ...
        if (this.audiocodecswitch && data.audioChannelCount === 2 && navigator.userAgent.toLowerCase().indexOf("android") === -1 && navigator.userAgent.toLowerCase().indexOf("firefox") === -1) {
          audioCodec = "mp4a.40.5";
        }
        if (!this.sourceBuffer) {
          this.sourceBuffer = {};
          logger.log("selected A/V codecs for sourceBuffers:" + audioCodec + "," + videoCodec);
          // create source Buffer and link them to MediaSource
          if (audioCodec) {
            sb = this.sourceBuffer.audio = this.mediaSource.addSourceBuffer("video/mp4;codecs=" + audioCodec);
            sb.addEventListener("updateend", this.onsbue);
            sb.addEventListener("error", this.onsbe);
          }
          if (videoCodec) {
            sb = this.sourceBuffer.video = this.mediaSource.addSourceBuffer("video/mp4;codecs=" + videoCodec);
            sb.addEventListener("updateend", this.onsbue);
            sb.addEventListener("error", this.onsbe);
          }
        }
        if (audioCodec) {
          this.mp4segments.push({ type: "audio", data: data.audioMoov });
        }
        if (videoCodec) {
          this.mp4segments.push({ type: "video", data: data.videoMoov });
        }
        //trigger handler right now
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onFragmentParsing: {
      value: function onFragmentParsing(event, data) {
        this.tparse2 = Date.now();
        var level = this.levels[this.level];
        if (level.details.live) {
          level.details.sliding = data.startPTS - this.frag.start;
        }
        logger.log("      parsed data, type/startPTS/endPTS/startDTS/endDTS/sliding:" + data.type + "/" + data.startPTS.toFixed(3) + "/" + data.endPTS.toFixed(3) + "/" + data.startDTS.toFixed(3) + "/" + data.endDTS.toFixed(3) + "/" + level.details.sliding.toFixed(3));
        this.mp4segments.push({ type: data.type, data: data.moof });
        this.mp4segments.push({ type: data.type, data: data.mdat });
        this.nextLoadPosition = data.endPTS;
        this.bufferRange.push({ type: data.type, start: data.startPTS, end: data.endPTS, frag: this.frag });
        //trigger handler right now
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onFragmentParsed: {
      value: function onFragmentParsed() {
        this.state = PARSED;
        this.stats.tparsed = new Date();
        //trigger handler right now
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onSourceBufferUpdateEnd: {
      value: function onSourceBufferUpdateEnd() {
        //trigger handler right now
        if (this.state === APPENDING && this.mp4segments.length === 0) {
          this.stats.tbuffered = new Date();
          observer.trigger(Event.FRAG_BUFFERED, { stats: this.stats, frag: this.frag });
          this.state = IDLE;
        }
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onSourceBufferError: {
      value: function onSourceBufferError(event) {
        logger.log(" buffer append error:" + event);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return BufferController;
})();

module.exports = BufferController;
//logger.log('sb append in progress');
// check if any MP4 segments left to append

},{"../demux/demuxer":5,"../events":9,"../loader/fragment-loader":11,"../observer":13,"../utils/logger":15}],4:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
 * level controller
 *
 */

var Event = _interopRequire(require("../events"));

var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var LevelController = (function () {
  function LevelController(playlistLoader) {
    this.playlistLoader = playlistLoader;
    this.onml = this.onManifestLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.ontick = this.tick.bind(this);
    observer.on(Event.MANIFEST_LOADED, this.onml);
    observer.on(Event.FRAG_LOADED, this.onfl);
    observer.on(Event.LEVEL_LOADED, this.onll);
    this._manualLevel = this._autoLevelCapping = -1;
    //this.startLevel = startLevel;
  }

  _prototypeProperties(LevelController, null, {
    destroy: {
      value: function destroy() {
        observer.removeListener(Event.MANIFEST_LOADED, this.onml);
        observer.removeListener(Event.FRAG_LOADED, this.onfl);
        observer.removeListener(Event.LEVEL_LOADED, this.onll);
        if (this.timer) {
          clearInterval(this.timer);
        }
        this._manualLevel = -1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onManifestLoaded: {
      value: function onManifestLoaded(event, data) {
        var levels = [],
            bitrateStart,
            i,
            bitrateSet = {},
            aac = false,
            heaac = false,
            codecs;
        // remove failover level for now to simplify the logic
        data.levels.forEach(function (level) {
          if (!bitrateSet.hasOwnProperty(level.bitrate)) {
            levels.push(level);
            bitrateSet[level.bitrate] = true;
          }
          // detect if we have different kind of audio codecs used amongst playlists
          codecs = level.codecs;
          if (codecs) {
            if (codecs.indexOf("mp4a.40.2") !== -1) {
              aac = true;
            }
            if (codecs.indexOf("mp4a.40.5") !== -1) {
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
            logger.log("manifest loaded," + levels.length + " level(s) found, first bitrate:" + bitrateStart);
            break;
          }
        }

        //this._startLevel = -1;
        observer.trigger(Event.MANIFEST_PARSED, { levels: this._levels,
          startLevel: this._startLevel,
          audiocodecswitch: aac && heaac
        });
        return;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    levels: {
      get: function () {
        return this._levels;
      },
      enumerable: true,
      configurable: true
    },
    level: {
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
            logger.log("switching to level " + newLevel);
            observer.trigger(Event.LEVEL_SWITCH, { levelId: newLevel });
            var level = this._levels[newLevel];
            // check if we need to load playlist for this level
            if (level.loading === undefined || level.details && level.details.live === true) {
              // level not retrieved yet, or live playlist we need to (re)load it
              observer.trigger(Event.LEVEL_LOADING, { levelId: newLevel });
              logger.log("(re)loading playlist for level " + newLevel);
              this.playlistLoader.load(level.url, newLevel);
              level.loading = true;
            }
          } else {
            // invalid level id given, trigger error
            observer.trigger(Event.LEVEL_ERROR, { level: newLevel, event: "invalid level idx" });
          }
        }
      },
      enumerable: true,
      configurable: true
    },
    manualLevel: {
      get: function () {
        return this._manualLevel;
      },
      set: function (newLevel) {
        this._manualLevel = newLevel;
        this.level = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    autoLevelCapping: {

      /** Return the capping/max level value that could be used by automatic level selection algorithm **/
      get: function () {
        return this._autoLevelCapping;
      },


      /** set the capping/max level value that could be used by automatic level selection algorithm **/
      set: function (newLevel) {
        this._autoLevelCapping = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    firstLevel: {
      get: function () {
        return this._firstLevel;
      },
      set: function (newLevel) {
        this._firstLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    startLevel: {
      get: function () {
        if (this._startLevel === undefined) {
          return this._firstLevel;
        } else {
          return this._startLevel;
        }
      },
      set: function (newLevel) {
        this._startLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    onFragmentLoaded: {
      value: function onFragmentLoaded(event, data) {
        var stats, rtt;
        stats = data.stats;
        rtt = stats.tfirst - stats.trequest;
        this.lastfetchduration = (stats.tload - stats.trequest) / 1000;
        this.lastfetchlevel = data.frag.level;
        this.lastbw = stats.length * 8 / this.lastfetchduration;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onLevelLoaded: {
      value: function onLevelLoaded(event, data) {
        // check if current playlist is a live playlist
        if (data.details.live && !this.timer) {
          // if live playlist we will have to reload it periodically
          // set reload period to playlist target duration
          this.timer = setInterval(this.ontick, 1000 * data.details.targetduration);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    tick: {
      value: function tick() {
        observer.trigger(Event.LEVEL_LOADING, { levelId: this._level });
        this.playlistLoader.load(this._levels[this._level].url, this._level);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    nextLevel: {
      value: function nextLevel() {
        if (this._manualLevel !== -1) {
          return this._manualLevel;
        } else {
          return this.nextAutoLevel();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    nextFetchDuration: {
      value: function nextFetchDuration() {
        if (this.lastfetchduration) {
          return this.lastfetchduration * this._levels[this._level].bitrate / this._levels[this.lastfetchlevel].bitrate;
        } else {
          return 0;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    nextAutoLevel: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return LevelController;
})();

module.exports = LevelController;

},{"../events":9,"../observer":13,"../utils/logger":15}],5:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

var Event = _interopRequire(require("../events"));

var TSDemuxer = _interopRequire(require("./tsdemuxer"));

var TSDemuxerWorker = _interopRequire(require("./tsdemuxerworker"));

var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var Demuxer = (function () {
  function Demuxer() {
    var enableWorker = true;
    if (enableWorker && typeof Worker !== "undefined") {
      logger.log("TS demuxing in webworker");
      try {
        var work = require("webworkify");
        this.w = work(TSDemuxerWorker);
        this.onwmsg = this.onWorkerMessage.bind(this);
        this.w.addEventListener("message", this.onwmsg);
        this.w.postMessage({ cmd: "init" });
      } catch (err) {
        logger.log("error while initializing TSDemuxerWorker, fallback on regular TSDemuxer");
        this.demuxer = new TSDemuxer();
      }
    } else {
      this.demuxer = new TSDemuxer();
    }
    this.demuxInitialized = true;
  }

  _prototypeProperties(Demuxer, null, {
    setDuration: {
      value: function setDuration(newDuration) {
        if (this.w) {
          // post fragment payload as transferable objects (no copy)
          this.w.postMessage({ cmd: "duration", data: newDuration });
        } else {
          this.demuxer.setDuration(newDuration);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    destroy: {
      value: function destroy() {
        if (this.w) {
          this.w.removeEventListener("message", this.onwmsg);
          this.w.terminate();
          this.w = null;
        } else {
          this.demuxer.destroy();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {
      value: function push(data, audioCodec, videoCodec, timeOffset) {
        if (this.w) {
          // post fragment payload as transferable objects (no copy)
          this.w.postMessage({ cmd: "demux", data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset }, [data]);
        } else {
          this.demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset);
          this.demuxer.end();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    switchLevel: {
      value: function switchLevel() {
        if (this.w) {
          // post fragment payload as transferable objects (no copy)
          this.w.postMessage({ cmd: "switchLevel" });
        } else {
          this.demuxer.switchLevel();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onWorkerMessage: {
      value: function onWorkerMessage(ev) {
        //console.log('onWorkerMessage:' + ev.data.event);
        switch (ev.data.event) {
          case Event.FRAG_PARSING_INIT_SEGMENT:
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
            observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, obj);
            break;
          case Event.FRAG_PARSING_DATA:
            observer.trigger(Event.FRAG_PARSING_DATA, {
              moof: new Uint8Array(ev.data.moof),
              mdat: new Uint8Array(ev.data.mdat),
              startPTS: ev.data.startPTS,
              endPTS: ev.data.endPTS,
              startDTS: ev.data.startDTS,
              endDTS: ev.data.endDTS,
              type: ev.data.type
            });
            break;
          case Event.FRAG_PARSED:
            observer.trigger(Event.FRAG_PARSED);
            break;
          default:
            break;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Demuxer;
})();

module.exports = Demuxer;

},{"../events":9,"../observer":13,"../utils/logger":15,"./tsdemuxer":7,"./tsdemuxerworker":8,"webworkify":2}],6:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding
 * scheme used by h264.
 */

var logger = require("../utils/logger").logger;
var ExpGolomb = (function () {
  function ExpGolomb(workingData) {
    this.workingData = workingData;
    // the number of bytes left to examine in this.workingData
    this.workingBytesAvailable = this.workingData.byteLength;
    // the current word being examined
    this.workingWord = 0; // :uint
    // the number of bits left to examine in the current word
    this.workingBitsAvailable = 0; // :uint
  }

  _prototypeProperties(ExpGolomb, null, {
    loadWord: {

      // ():void
      value: function loadWord() {
        var position = this.workingData.byteLength - this.workingBytesAvailable,
            workingBytes = new Uint8Array(4),
            availableBytes = Math.min(4, this.workingBytesAvailable);

        if (availableBytes === 0) {
          throw new Error("no bytes available");
        }

        workingBytes.set(this.workingData.subarray(position, position + availableBytes));
        this.workingWord = new DataView(workingBytes.buffer).getUint32(0);

        // track the amount of this.workingData that has been processed
        this.workingBitsAvailable = availableBytes * 8;
        this.workingBytesAvailable -= availableBytes;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipBits: {

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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readBits: {

      // (size:int):uint
      value: function readBits(size) {
        var bits = Math.min(this.workingBitsAvailable, size),
            // :uint
        valu = this.workingWord >>> 32 - bits; // :uint

        if (size > 32) {
          logger.error("Cannot read more than 32 bits at a time");
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipLeadingZeros: {

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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipUnsignedExpGolomb: {

      // ():void
      value: function skipUnsignedExpGolomb() {
        this.skipBits(1 + this.skipLeadingZeros());
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipExpGolomb: {

      // ():void
      value: function skipExpGolomb() {
        this.skipBits(1 + this.skipLeadingZeros());
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readUnsignedExpGolomb: {

      // ():uint
      value: function readUnsignedExpGolomb() {
        var clz = this.skipLeadingZeros(); // :uint
        return this.readBits(clz + 1) - 1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readExpGolomb: {

      // ():int
      value: function readExpGolomb() {
        var valu = this.readUnsignedExpGolomb(); // :int
        if (1 & valu) {
          // the number is odd if the low order bit is set
          return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
        } else {
          return -1 * (valu >>> 1); // divide by two then make it negative
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readBoolean: {

      // Some convenience functions
      // :Boolean
      value: function readBoolean() {
        return 1 === this.readBits(1);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readUnsignedByte: {

      // ():int
      value: function readUnsignedByte() {
        return this.readBits(8);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipScalingList: {

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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readSequenceParameterSet: {

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
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return ExpGolomb;
})();

module.exports = ExpGolomb;

},{"../utils/logger":15}],7:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/**
 * A stream-based mp2ts to mp4 converter. This utility is used to
 * deliver mp4s to a SourceBuffer on platforms that support native
 * Media Source Extensions.
 */

var Event = _interopRequire(require("../events"));

var ExpGolomb = _interopRequire(require("./exp-golomb"));

// import Hex             from '../utils/hex';
var MP4 = _interopRequire(require("../remux/mp4-generator"));

// import MP4Inspect      from '../remux/mp4-inspector';
var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var TSDemuxer = (function () {
  function TSDemuxer() {
    this.switchLevel();
  }

  _prototypeProperties(TSDemuxer, null, {
    setDuration: {
      value: function setDuration(newDuration) {
        this._duration = newDuration;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    switchLevel: {
      value: function switchLevel() {
        this.pmtParsed = false;
        this._pmtId = this._avcId = this._aacId = -1;
        this._avcTrack = { type: "video", sequenceNumber: 0 };
        this._aacTrack = { type: "audio", sequenceNumber: 0 };
        this._avcSamples = [];
        this._avcSamplesLength = 0;
        this._avcSamplesNbNalu = 0;
        this._aacSamples = [];
        this._aacSamplesLength = 0;
        this._initSegGenerated = false;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {

      // feed incoming data to the front of the parsing pipeline
      value: function push(data, audioCodec, videoCodec, timeOffset) {
        this.audioCodec = audioCodec;
        this.videoCodec = videoCodec;
        this.timeOffset = timeOffset;
        var offset;
        for (offset = 0; offset < data.length; offset += 188) {
          this._parseTSPacket(data, offset);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
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
        observer.trigger(Event.FRAG_PARSED);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    destroy: {
      value: function destroy() {
        this._duration = 0;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parseTSPacket: {
      value: function ParseTSPacket(data, start) {
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
          logger.log("parsing error");
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parsePAT: {
      value: function ParsePAT(data, offset) {
        // skip the PSI header and parse the first PMT entry
        this._pmtId = (data[offset + 10] & 31) << 8 | data[offset + 11];
        //logger.log('PMT PID:'  + this._pmtId);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parsePMT: {
      value: function ParsePMT(data, offset) {
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
              logger.log("unkown stream type:" + data[offset]);
              break;
          }
          // move to the next table entry
          // skip past the elementary stream descriptors, if present
          offset += ((data[offset + 3] & 15) << 8 | data[offset + 4]) + 5;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parsePES: {
      value: function ParsePES(stream) {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parseAVCPES: {
      value: function ParseAVCPES(pes) {
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
                var expGolombDecoder = new ExpGolomb(unit.data);
                var config = expGolombDecoder.readSequenceParameterSet();
                track.width = config.width;
                track.height = config.height;
                track.profileIdc = config.profileIdc;
                track.profileCompatibility = config.profileCompatibility;
                track.levelIdc = config.levelIdc;
                track.sps = [unit.data];
                track.duration = 90000 * _this._duration;
                var codecarray = unit.data.subarray(1, 4);
                var codecstring = "avc1.";
                for (var i = 0; i < 3; i++) {
                  var h = codecarray[i].toString(16);
                  if (h.length < 2) {
                    h = "0" + h;
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _flushAVCSamples: {
      value: function FlushAVCSamples() {
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
            firstDTS;
        track.samples = [];

        /* concatenate the video data and construct the mdat in place
          (need 8 more bytes to fill length and mpdat type) */
        mdat = new Uint8Array(this._avcSamplesLength + 4 * this._avcSamplesNbNalu + 8);
        view = new DataView(mdat.buffer);
        view.setUint32(0, mdat.byteLength);
        mdat.set(MP4.types.mdat, 4);
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
                  logger.log("AVC:" + delta.toFixed(0) + " ms hole between fragments detected,filling it");
                } else if (delta < -1) {
                  logger.log("AVC:" + -delta.toFixed(0) + " ms overlapping between fragments detected");
                }
                // set PTS to next PTS
                avcSample.pts = this.nextAvcPts;
                // offset DTS as well, ensure that DTS is smaller or equal than new PTS
                avcSample.dts = Math.max(avcSample.dts - delta, this.lastAvcDts);
                // logger.log('Video/PTS/DTS adjusted:' + avcSample.pts + '/' + avcSample.dts);
              }
            }
            // remember first PTS of our avcSamples
            firstPTS = avcSample.pts;
            firstDTS = avcSample.dts;
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
          track.samples.push(mp4Sample);
          lastSampleDTS = avcSample.dts;
        }
        mp4Sample.duration = track.samples[track.samples.length - 2].duration;
        this.lastAvcDts = avcSample.dts;
        // next AVC sample PTS should be equal to last sample PTS + duration
        this.nextAvcPts = avcSample.pts + mp4Sample.duration;
        //logger.log('Video/lastAvcDts/nextAvcPts:' + this.lastAvcDts + '/' + this.nextAvcPts);

        this._avcSamplesLength = 0;
        this._avcSamplesNbNalu = 0;

        moof = MP4.moof(track.sequenceNumber++, firstDTS, track);
        observer.trigger(Event.FRAG_PARSING_DATA, {
          moof: moof,
          mdat: mdat,
          startPTS: firstPTS / 90000,
          endPTS: this.nextAvcPts / 90000,
          startDTS: firstDTS / 90000,
          endDTS: (avcSample.dts + mp4Sample.duration) / 90000,
          type: "video"
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parseAVCNALu: {
      value: function ParseAVCNALu(array) {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parseAACPES: {
      value: function ParseAACPES(pes) {
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
            console.log(track.codec + ",rate:" + config.samplerate + ",nb channel:" + config.channelCount);
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
          observer.trigger(Event.FRAG_PARSING_ERROR, "Stream did not start with ADTS header.");
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _flushAACSamples: {
      value: function FlushAACSamples() {
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
            firstDTS;
        track.samples = [];

        /* concatenate the audio data and construct the mdat in place
          (need 8 more bytes to fill length and mpdat type) */
        mdat = new Uint8Array(this._aacSamplesLength + 8);
        view = new DataView(mdat.buffer);
        view.setUint32(0, mdat.byteLength);
        mdat.set(MP4.types.mdat, 4);
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
                  logger.log("AAC:" + delta.toFixed(0) + " ms hole between fragments detected,filling it");
                  // set PTS to next PTS, and ensure PTS is greater or equal than last DTS
                  aacSample.pts = Math.max(this.nextAacPts, this.lastAacDts);
                  aacSample.dts = aacSample.pts;
                  //logger.log('Audio/PTS/DTS adjusted:' + aacSample.pts + '/' + aacSample.dts);
                } else {
                  logger.log("AAC:" + -delta.toFixed(0) + " ms overlapping between fragments detected");
                }
              }
            }
            // remember first PTS of our avcSamples
            firstPTS = aacSample.pts;
            firstDTS = aacSample.dts;
          }

          mp4Sample = {
            size: unit.byteLength,
            compositionTimeOffset: 0,
            flags: {
              isLeading: 0,
              isDependedOn: 0,
              hasRedundancy: 0,
              degradationPriority: 0,
              dependsOn: 1 }
          };
          track.samples.push(mp4Sample);
          lastSampleDTS = aacSample.dts;
        }
        //set last sample duration as being identical to previous sample
        mp4Sample.duration = track.samples[track.samples.length - 2].duration;
        this.lastAacDts = aacSample.dts;
        // next aac sample PTS should be equal to last sample PTS + duration
        this.nextAacPts = aacSample.pts + mp4Sample.duration;
        //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));

        this._aacSamplesLength = 0;

        moof = MP4.moof(track.sequenceNumber++, firstDTS, track);
        observer.trigger(Event.FRAG_PARSING_DATA, {
          moof: moof,
          mdat: mdat,
          startPTS: firstPTS / 90000,
          endPTS: this.nextAacPts / 90000,
          startDTS: firstDTS / 90000,
          endDTS: (aacSample.dts + mp4Sample.duration) / 90000,
          type: "audio"
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _ADTStoAudioConfig: {
      value: function ADTStoAudioConfig(data, audioCodec) {
        var adtsObjectType,
            // :int
        adtsSampleingIndex,
            // :int
        adtsExtensionSampleingIndex,
            // :int
        adtsChanelConfig,
            // :int
        config,
            adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000];

        // byte 2
        adtsObjectType = ((data[2] & 192) >>> 6) + 1;
        adtsSampleingIndex = (data[2] & 60) >>> 2;
        adtsChanelConfig = (data[2] & 1) << 2;

        //  always force audio type to be HE-AAC SBR. some browsers do not support audio codec switch properly
        // in case stream is really HE-AAC: it should be either  advertised directly in codecs (retrieved from parsing manifest)
        // or if no codec specified,we implicitely assume that audio with sampling rate less or equal than 24 kHz is HE-AAC (index 6)
        // currently broken on Chrome/Android
        if (navigator.userAgent.toLowerCase().indexOf("android") === -1 && (audioCodec && audioCodec.indexOf("mp4a.40.5") !== -1 || !audioCodec && adtsSampleingIndex >= 6)) {
          adtsObjectType = 5;
          // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
          // there is a factor 2 between frame sample rate and output sample rate
          // multiply frequency by 2 (see table below, equivalent to substract 3)
          adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
          config = new Array(4);
        } else {
          if (navigator.userAgent.toLowerCase().indexOf("android") === -1 && navigator.userAgent.toLowerCase().indexOf("firefox") === -1) {
            adtsObjectType = 5;
            config = new Array(4);
          } else {
            adtsObjectType = 2;
            config = new Array(2);
          }
          adtsExtensionSampleingIndex = adtsSampleingIndex;
        }
        // byte 3
        adtsChanelConfig |= (data[3] & 192) >>> 6;
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
        return { config: config, samplerate: adtsSampleingRates[adtsSampleingIndex], channelCount: adtsChanelConfig, codec: "mp4a.40." + adtsObjectType };
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _generateInitSegment: {
      value: function GenerateInitSegment() {
        if (this._avcId === -1) {
          //audio only
          if (this._aacTrack.config) {
            observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
              audioMoov: MP4.initSegment([this._aacTrack]),
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
            observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
              videoMoov: MP4.initSegment([this._avcTrack]),
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
            observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
              audioMoov: MP4.initSegment([this._aacTrack]),
              audioCodec: this._aacTrack.codec,
              audioChannelCount: this._aacTrack.channelCount,
              videoMoov: MP4.initSegment([this._avcTrack]),
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return TSDemuxer;
})();

module.exports = TSDemuxer;

},{"../events":9,"../observer":13,"../remux/mp4-generator":14,"../utils/logger":15,"./exp-golomb":6}],8:[function(require,module,exports){
"use strict";

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

var Event = _interopRequire(require("../events"));

var TSDemuxer = _interopRequire(require("../demux/tsdemuxer"));

var observer = _interopRequire(require("../observer"));

var TSDemuxerWorker = function TSDemuxerWorker() {
  self.addEventListener("message", function (ev) {
    //console.log('demuxer cmd:' + ev.data.cmd);
    switch (ev.data.cmd) {
      case "init":
        self.demuxer = new TSDemuxer();
        break;
      case "duration":
        self.demuxer.setDuration(ev.data.data);
        break;
      case "switchLevel":
        self.demuxer.switchLevel();
        break;
      case "demux":
        self.demuxer.push(new Uint8Array(ev.data.data), ev.data.audioCodec, ev.data.videoCodec, ev.data.timeOffset);
        self.demuxer.end();
        break;
      default:
        break;
    }
  });

  // listen to events triggered by TS Demuxer
  observer.on(Event.FRAG_PARSING_INIT_SEGMENT, function (ev, data) {
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
  observer.on(Event.FRAG_PARSING_DATA, function (ev, data) {
    var objData = { event: ev, type: data.type, startPTS: data.startPTS, endPTS: data.endPTS, startDTS: data.startDTS, endDTS: data.endDTS, moof: data.moof.buffer, mdat: data.mdat.buffer };
    // pass moof/mdat data as transferable object (no copy)
    self.postMessage(objData, [objData.moof, objData.mdat]);
  });
  observer.on(Event.FRAG_PARSED, function (ev) {
    var objData = { event: ev };
    self.postMessage(objData);
  });
};

module.exports = TSDemuxerWorker;

},{"../demux/tsdemuxer":7,"../events":9,"../observer":13}],9:[function(require,module,exports){
"use strict";

module.exports = {
  // fired when MediaSource has been succesfully attached to video element - data: { mediaSource }
  MSE_ATTACHED: "hlsMediaSourceAttached",
  // fired after manifest has been loaded - data: { levels : [available quality levels] , url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
  MANIFEST_LOADED: "hlsManifestLoaded",
  // fired after manifest has been parsed - data: { levels : [available quality levels] , startLevel : playback start level, audiocodecswitch: true if different audio codecs used}
  MANIFEST_PARSED: "hlsManifestParsed",
  // fired when a level playlist loading starts - data: { levelId : id of level being loaded}
  LEVEL_LOADING: "hlsLevelLoading",
  // fired when a level playlist loading finishes - data: { details : levelDetails object, levelId : id of loaded level, stats : { trequest, tfirst, tload, mtime} }
  LEVEL_LOADED: "hlsLevelLoaded",
  // fired when a level switch is requested - data: { levelId : id of new level }
  LEVEL_SWITCH: "hlsLevelSwitch",
  // fired when a fragment loading starts - data: { frag : fragment object}
  FRAG_LOADING: "hlsFragmentLoading",
  // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length}}
  FRAG_LOADED: "hlsFragmentLoaded",
  // fired when Init Segment has been extracted from fragment - data: { moov : moov MP4 box, codecs : codecs found while parsing fragment}
  FRAG_PARSING_INIT_SEGMENT: "hlsFragmentParsingInitSegment",
  // fired when moof/mdat have been extracted from fragment - data: { moof : moof MP4 box, mdat : mdat MP4 box}
  FRAG_PARSING_DATA: "hlsFragmentParsingData",
  // fired when fragment parsing is completed - data: undefined
  FRAG_PARSED: "hlsFragmentParsed",
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED: "hlsFragmentBuffered",
  // fired when fragment matching with current video position is changing - data : { frag : fragment object }
  FRAG_CHANGED: "hlsFragmentChanged",
  // Identifier for fragment/playlist load error - data: { url : faulty URL, response : XHR response}
  LOAD_ERROR: "hlsLoadError",
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_ERROR: "hlsLevelError",
  // Identifier for a video error -  data: undefined
  VIDEO_ERROR: "hlsVideoError",
  // Identifier for a fragment parsing error event - data: parsing error description
  FRAG_PARSING_ERROR: "hlsFragmentParsingError"
};

},{}],10:[function(require,module,exports){
/**
 * HLS engine
 */
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

var Event = _interopRequire(require("./events"));

var observer = _interopRequire(require("./observer"));

var PlaylistLoader = _interopRequire(require("./loader/playlist-loader"));

var BufferController = _interopRequire(require("./controller/buffer-controller"));

var LevelController = _interopRequire(require("./controller/level-controller"));

var logger = require("./utils/logger").logger;
var enableLogs = require("./utils/logger").enableLogs;
//import MP4Inspect         from '/remux/mp4-inspector';

var Hls = (function () {
  function Hls() {
    this.playlistLoader = new PlaylistLoader();
    this.levelController = new LevelController(this.playlistLoader);
    this.bufferController = new BufferController(this.levelController);
    this.Events = Event;
    this.debug = enableLogs;
    this.logEvt = this.logEvt;
    // observer setup
    this.on = observer.on.bind(observer);
    this.off = observer.removeListener.bind(observer);
  }

  _prototypeProperties(Hls, {
    isSupported: {
      value: function isSupported() {
        return window.MediaSource && MediaSource.isTypeSupported("video/mp4; codecs=\"avc1.42E01E,mp4a.40.2\"");
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    destroy: {
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
        observer.removeAllListeners();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    attachVideo: {
      value: function attachVideo(video) {
        this.video = video;
        // setup the media source
        var ms = this.mediaSource = new MediaSource();
        //Media Source listeners
        this.onmso = this.onMediaSourceOpen.bind(this);
        this.onmse = this.onMediaSourceEnded.bind(this);
        this.onmsc = this.onMediaSourceClose.bind(this);
        ms.addEventListener("sourceopen", this.onmso);
        ms.addEventListener("sourceended", this.onmse);
        ms.addEventListener("sourceclose", this.onmsc);
        // link video and media Source
        video.src = URL.createObjectURL(ms);
        this.onverror = this.onVideoError.bind(this);
        video.addEventListener("error", this.onverror);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    detachVideo: {
      value: function detachVideo() {
        var video = this.video;
        var ms = this.mediaSource;
        if (ms) {
          ms.endOfStream();
          ms.removeEventListener("sourceopen", this.onmso);
          ms.removeEventListener("sourceended", this.onmse);
          ms.removeEventListener("sourceclose", this.onmsc);
          // unlink MediaSource from video tag
          video.src = "";
          this.mediaSource = null;
        }
        this.onmso = this.onmse = this.onmsc = null;
        if (video) {
          this.video = null;
          // remove video error listener
          video.removeEventListener("error", this.onverror);
          this.onverror = null;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadSource: {
      value: function loadSource(url) {
        this.url = url;
        logger.log("loadSource:" + url);
        // when attaching to a source URL, trigger a playlist load
        this.playlistLoader.load(url, null);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    unloadSource: {
      value: function unloadSource() {
        this.url = null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    levels: {

      /** Return all quality levels **/
      get: function () {
        return this.levelController.levels;
      },
      enumerable: true,
      configurable: true
    },
    currentLevel: {

      /** Return current playback quality level **/
      get: function () {
        return this.bufferController.currentLevel;
      },


      /* set quality level immediately (-1 for automatic level selection) */
      set: function (newLevel) {
        this.loadLevel = newLevel;
        this.bufferController.immediateLevelSwitch();
      },
      enumerable: true,
      configurable: true
    },
    nextLevel: {

      /** Return next playback quality level (quality level of next fragment) **/
      get: function () {
        return this.bufferController.nextLevel;
      },


      /* set quality level for next fragment (-1 for automatic level selection) */
      set: function (newLevel) {
        this.loadLevel = newLevel;
        this.bufferController.nextLevelSwitch();
      },
      enumerable: true,
      configurable: true
    },
    loadLevel: {

      /** Return the quality level of last loaded fragment **/
      get: function () {
        return this.levelController.level;
      },


      /* set quality level for next loaded fragment (-1 for automatic level selection) */
      set: function (newLevel) {
        this.levelController.manualLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    firstLevel: {

      /** Return first level (index of first level referenced in manifest)
      **/
      get: function () {
        return this.levelController.firstLevel;
      },


      /** set first level (index of first level referenced in manifest)
      **/
      set: function (newLevel) {
        this.levelController.firstLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    startLevel: {

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
      },
      enumerable: true,
      configurable: true
    },
    autoLevelCapping: {

      /** Return the capping/max level value that could be used by automatic level selection algorithm **/
      get: function () {
        return this.levelController.autoLevelCapping;
      },


      /** set the capping/max level value that could be used by automatic level selection algorithm **/
      set: function (newLevel) {
        this.levelController.autoLevelCapping = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    autoLevelEnabled: {

      /* check if we are in automatic level selection mode */
      get: function () {
        return this.levelController.manualLevel === -1;
      },
      enumerable: true,
      configurable: true
    },
    manualLevel: {

      /* return manual level */
      get: function () {
        return this.levelController.manualLevel;
      },
      enumerable: true,
      configurable: true
    },
    onMediaSourceOpen: {
      value: function onMediaSourceOpen() {
        observer.trigger(Event.MSE_ATTACHED, { video: this.video, mediaSource: this.mediaSource });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onMediaSourceClose: {
      value: function onMediaSourceClose() {
        logger.log("media source closed");
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onMediaSourceEnded: {
      value: function onMediaSourceEnded() {
        logger.log("media source ended");
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onVideoError: {
      value: function onVideoError() {
        observer.trigger(Event.VIDEO_ERROR);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Hls;
})();

module.exports = Hls;

},{"./controller/buffer-controller":3,"./controller/level-controller":4,"./events":9,"./loader/playlist-loader":12,"./observer":13,"./utils/logger":15}],11:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
* fragment loader
*
*/

var Event = _interopRequire(require("../events"));

var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var FragmentLoader = (function () {
  function FragmentLoader() {}

  _prototypeProperties(FragmentLoader, null, {
    destroy: {
      value: function destroy() {
        this.abort();
        this.xhr = null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    abort: {
      value: function abort() {
        if (this.xhr && this.xhr.readyState !== 4) {
          this.xhr.abort();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    load: {
      value: function load(frag, levelId) {
        this.frag = frag;
        this.levelId = levelId;
        this.trequest = new Date();
        this.tfirst = null;
        var xhr = this.xhr = new XMLHttpRequest();
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.open("GET", frag.url, true);
        xhr.responseType = "arraybuffer";
        xhr.send();
        observer.trigger(Event.FRAG_LOADING, { frag: frag });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event) {
        var payload = event.currentTarget.response;
        observer.trigger(Event.FRAG_LOADED, { payload: payload,
          frag: this.frag,
          stats: { trequest: this.trequest, tfirst: this.tfirst, tload: new Date(), length: payload.byteLength } });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        logger.log("error loading " + this.frag.url);
        observer.trigger(Event.LOAD_ERROR, { url: this.frag.url, event: event });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadprogress: {
      value: function loadprogress() {
        if (this.tfirst === null) {
          this.tfirst = new Date();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return FragmentLoader;
})();

module.exports = FragmentLoader;

},{"../events":9,"../observer":13,"../utils/logger":15}],12:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
 * playlist loader
 *
 */

var Event = _interopRequire(require("../events"));

var observer = _interopRequire(require("../observer"));

//import {logger}             from '../utils/logger';

var PlaylistLoader = (function () {
  function PlaylistLoader() {
    this.manifestLoaded = false;
  }

  _prototypeProperties(PlaylistLoader, null, {
    destroy: {
      value: function destroy() {
        if (this.xhr && this.xhr.readyState !== 4) {
          this.xhr.abort();
          this.xhr = null;
        }
        this.url = this.id = null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    load: {
      value: function load(url, requestId) {
        this.url = url;
        this.id = requestId;
        this.stats = { trequest: new Date() };
        var xhr = this.xhr = new XMLHttpRequest();
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.open("GET", url, true);
        xhr.send();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    resolve: {
      value: function resolve(url, baseUrl) {
        var doc = document,
            oldBase = doc.getElementsByTagName("base")[0],
            oldHref = oldBase && oldBase.href,
            docHead = doc.head || doc.getElementsByTagName("head")[0],
            ourBase = oldBase || docHead.appendChild(doc.createElement("base")),
            resolver = doc.createElement("a"),
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parseMasterPlaylist: {
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
              case "RES":
                level.width = parseInt(result.shift());
                level.height = parseInt(result.shift());
                break;
              case "BAND":
                level.bitrate = parseInt(result.shift());
                break;
              case "NAME":
                level.name = result.shift();
                break;
              case "CODECS":
                codecs = result.shift().split(",");
                while (codecs.length > 0) {
                  codec = codecs.shift();
                  if (codec.indexOf("avc1") !== -1) {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    avc1toavcoti: {
      value: function avc1toavcoti(codec) {
        var result,
            avcdata = codec.split(".");
        if (avcdata.length > 2) {
          result = avcdata.shift() + ".";
          result += parseInt(avcdata.shift()).toString(16);
          result += ("00" + parseInt(avcdata.shift()).toString(16)).substr(-4);
        } else {
          result = codec;
        }
        return result;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parseLevelPlaylist: {
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
            case "MEDIA-SEQUENCE":
              currentSN = level.startSN = parseInt(result[1]);
              break;
            case "TARGETDURATION":
              level.targetduration = parseFloat(result[1]);
              break;
            case "ENDLIST":
              level.live = false;
              break;
            case "INF":
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event) {
        var data,
            string = event.currentTarget.responseText,
            url = event.currentTarget.responseURL,
            id = this.id;
        // responseURL not supported on some browsers (it is used to detect URL redirection)
        if (url === undefined) {
          // fallback to initial URL
          url = this.url;
        }
        this.stats.tload = new Date();
        this.stats.mtime = new Date(this.xhr.getResponseHeader("Last-Modified"));

        if (string.indexOf("#EXTM3U") === 0) {
          if (string.indexOf("#EXTINF:") > 0) {
            // 1 level playlist, parse it
            data = this.parseLevelPlaylist(string, url, id);
            // if first request, fire manifest loaded event beforehand
            if (this.id === null) {
              observer.trigger(Event.MANIFEST_LOADED, { levels: [data],
                url: url,
                stats: this.stats });
            }
            observer.trigger(Event.LEVEL_LOADED, { details: data,
              levelId: id,
              stats: this.stats });
          } else {
            // multi level playlist, parse level info
            observer.trigger(Event.MANIFEST_LOADED, { levels: this.parseMasterPlaylist(string, url),
              url: url,
              id: id,
              stats: this.stats });
          }
        } else {
          observer.trigger(Event.LOAD_ERROR, { url: url, response: event.currentTarget });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        observer.trigger(Event.LOAD_ERROR, { url: this.url, response: event.currentTarget });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadprogress: {
      value: function loadprogress() {
        if (this.stats.tfirst === undefined) {
          this.stats.tfirst = new Date();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return PlaylistLoader;
})();

module.exports = PlaylistLoader;

},{"../events":9,"../observer":13}],13:[function(require,module,exports){
"use strict";

var _toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

var EventEmitter = _interopRequire(require("events"));

var observer = new EventEmitter();

observer.trigger = function trigger(event) {
  for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    data[_key - 1] = arguments[_key];
  }

  observer.emit.apply(observer, [event, event].concat(_toArray(data)));
};

module.exports = observer;

},{"events":1}],14:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

/**
 * generate MP4 Box
 */

var MP4 = (function () {
  function MP4() {}

  _prototypeProperties(MP4, {
    init: {
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

        MP4.MAJOR_BRAND = new Uint8Array(["i".charCodeAt(0), "s".charCodeAt(0), "o".charCodeAt(0), "m".charCodeAt(0)]);
        MP4.AVC1_BRAND = new Uint8Array(["a".charCodeAt(0), "v".charCodeAt(0), "c".charCodeAt(0), "1".charCodeAt(0)]);
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
          video: MP4.VIDEO_HDLR,
          audio: MP4.AUDIO_HDLR
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    box: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    hdlr: {
      value: function hdlr(type) {
        return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mdat: {
      value: function mdat(data) {
        return MP4.box(MP4.types.mdat, data);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mdhd: {
      value: function mdhd(duration) {
        return MP4.box(MP4.types.mdhd, new Uint8Array([0, // version 0
        0, 0, 0, // flags
        0, 0, 0, 2, // creation_time
        0, 0, 0, 3, // modification_time
        0, 1, 95, 144, duration >> 24, duration >> 16 & 255, duration >> 8 & 255, duration & 255, // duration
        85, 196, // 'und' language (undetermined)
        0, 0]));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mdia: {
      value: function mdia(track) {
        return MP4.box(MP4.types.mdia, MP4.mdhd(track.duration), MP4.hdlr(track.type), MP4.minf(track));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mfhd: {
      value: function mfhd(sequenceNumber) {
        return MP4.box(MP4.types.mfhd, new Uint8Array([0, 0, 0, 0, sequenceNumber >> 24, sequenceNumber >> 16 & 255, sequenceNumber >> 8 & 255, sequenceNumber & 255]));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    minf: {
      value: function minf(track) {
        if (track.type === "audio") {
          return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
        } else {
          return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    moof: {
      value: function moof(sn, baseMediaDecodeTime, track) {
        return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    moov: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mvex: {
      value: function mvex(tracks) {
        var i = tracks.length,
            boxes = [];

        while (i--) {
          boxes[i] = MP4.trex(tracks[i]);
        }
        return MP4.box.apply(null, [MP4.types.mvex].concat(boxes));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mvhd: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    sdtp: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stbl: {
      value: function stbl(track) {
        return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    avc1: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    esds: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mp4a: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stsd: {
      value: function stsd(track) {
        if (track.type === "audio") {
          return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
        } else {
          return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    tkhd: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    traf: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    trak: {

      /**
       * Generate a track box.
       * @param track {object} a track definition
       * @return {Uint8Array} the track box
       */
      value: function trak(track) {
        track.duration = track.duration || 4294967295;
        return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    trex: {
      value: function trex(track) {
        return MP4.box(MP4.types.trex, new Uint8Array([0, // version 0
        0, 0, 0, track.id >> 24, track.id >> 16 & 255, track.id >> 8 & 255, track.id & 255, // track_ID
        0, 0, 0, 1, // default_sample_description_index
        0, 0, 0, 0, // default_sample_duration
        0, 0, 0, 0, // default_sample_size
        0, 1, 0, 1 // default_sample_flags
        ]));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    trun: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    initSegment: {
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return MP4;
})();

module.exports = MP4;
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
"use strict";

function noop() {}
var fakeLogger = {
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};
var exportedLogger = fakeLogger;

var enableLogs = exports.enableLogs = function (debug) {
  if (debug === true || typeof debug === "object") {
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
var logger = exports.logger = exportedLogger;

},{}]},{},[10])(10)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2V2ZW50cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvaGxzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvcGxheWxpc3QtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9vYnNlcnZlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvbG9nZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QUMsQ0FBQyxDQUFDO0FBQ2pELFdBQUcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FDOUIsQ0FBSTtBQUNKLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUNoQixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsVUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsRUFBSSxFQUFFLEVBQUksRUFBRSxHQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxDQUFJO1NBQzdCLENBQUMsQ0FBQztBQUNILFdBQUcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FDOUIsQ0FBSTtBQUNKLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUNoQixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsVUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsRUFBSSxFQUFFLEVBQUksRUFBRSxHQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxDQUFJO1NBQzdCLENBQUMsQ0FBQztBQUNILFdBQUcsQ0FBQyxV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QUFJO0FBQ1YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7U0FDdkIsQ0FBQyxDQUFDO0FBQ0wsZUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO09BQ3ZDOzs7OztBQUVNLFFBQUk7YUFBQSxjQUFDLEtBQUssRUFBRTtBQUNqQixZQUNFLE9BQU8sR0FBRyxLQUFLLENB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QUM3QixLQUFLLENBQUMsUUFBUSxHQUFHLEdBQUk7QUFDckIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLEVBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsQUFBQyxhQUFLLENBQUMsS0FBSyxJQUFJLENBQUMsR0FBSSxHQUFJLEVBQ3pCLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBSSxFQUNsQixDQUFJLEVBQUUsQ0FBSTtBQUNWLEFBQUMsYUFBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLEdBQUksR0FBSSxFQUMxQixLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUksRUFDbkIsQ0FBSSxFQUFFLENBQUk7U0FDWCxDQUFDLENBQUMsQ0FBQztPQUNMOzs7OztBQUVNLFFBQUk7YUFBQSxjQUFDLEtBQUssRUFBQyxtQkFBbUIsRUFBRTtBQUNyQyxZQUFJLHFCQUFxQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDNUMsZUFBTyxHQUFH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bmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuICAgIFxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICBpZiAoY2FjaGVba2V5XS5leHBvcnRzID09PSBmbikge1xuICAgICAgICAgICAgd2tleSA9IGtleTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgXG4gICAgdmFyIHNjYWNoZSA9IHt9OyBzY2FjaGVbd2tleV0gPSB3a2V5O1xuICAgIHNvdXJjZXNbc2tleV0gPSBbXG4gICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZSddLCdyZXF1aXJlKCcgKyBzdHJpbmdpZnkod2tleSkgKyAnKShzZWxmKScpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuICAgIFxuICAgIHZhciBzcmMgPSAnKCcgKyBidW5kbGVGbiArICcpKHsnXG4gICAgICAgICsgT2JqZWN0LmtleXMoc291cmNlcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdpZnkoa2V5KSArICc6WydcbiAgICAgICAgICAgICAgICArIHNvdXJjZXNba2V5XVswXVxuICAgICAgICAgICAgICAgICsgJywnICsgc3RyaW5naWZ5KHNvdXJjZXNba2V5XVsxXSkgKyAnXSdcbiAgICAgICAgICAgIDtcbiAgICAgICAgfSkuam9pbignLCcpXG4gICAgICAgICsgJ30se30sWycgKyBzdHJpbmdpZnkoc2tleSkgKyAnXSknXG4gICAgO1xuICAgIFxuICAgIHZhciBVUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkw7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogYnVmZmVyIGNvbnRyb2xsZXJcbiAqXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBGcmFnbWVudExvYWRlciAgICAgICBmcm9tICcuLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCBEZW11eGVyICAgICAgICAgICAgICBmcm9tICcuLi9kZW11eC9kZW11eGVyJztcblxuICBjb25zdCBTVEFSVElORyA9IC0xO1xuICBjb25zdCBJRExFID0gMDtcbiAgY29uc3QgTE9BRElORyA9ICAxO1xuICBjb25zdCBXQUlUSU5HX0xFVkVMID0gMjtcbiAgY29uc3QgUEFSU0lORyA9IDM7XG4gIGNvbnN0IFBBUlNFRCA9IDQ7XG4gIGNvbnN0IEFQUEVORElORyA9IDU7XG4gIGNvbnN0IEJVRkZFUl9GTFVTSElORyA9IDY7XG5cbiBjbGFzcyBCdWZmZXJDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihsZXZlbENvbnRyb2xsZXIpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IGxldmVsQ29udHJvbGxlcjtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKCk7XG4gICAgdGhpcy5tcDRzZWdtZW50cyA9IFtdO1xuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBbXTtcbiAgICB0aGlzLmZsdXNoUmFuZ2UgPSBbXTtcbiAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgLy8gU291cmNlIEJ1ZmZlciBsaXN0ZW5lcnNcbiAgICB0aGlzLm9uc2J1ZSA9IHRoaXMub25Tb3VyY2VCdWZmZXJVcGRhdGVFbmQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uc2JlICA9IHRoaXMub25Tb3VyY2VCdWZmZXJFcnJvci5iaW5kKHRoaXMpO1xuICAgIC8vIGludGVybmFsIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTVNFQXR0YWNoZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXAgPSB0aGlzLm9uTWFuaWZlc3RQYXJzZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmwgPSB0aGlzLm9uRnJhZ21lbnRMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uaXMgPSB0aGlzLm9uSW5pdFNlZ21lbnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZnBnID0gdGhpcy5vbkZyYWdtZW50UGFyc2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcCA9IHRoaXMub25GcmFnbWVudFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTVNFX0FUVEFDSEVELCB0aGlzLm9ubXNlKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHRoaXMub25tcCk7XG4gICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXIoKTtcbiAgfVxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuZGVzdHJveSgpO1xuICAgIGlmKHRoaXMuZGVtdXhlcikge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMubXA0c2VnbWVudHMgPSBbXTtcbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gW107XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgaWYoc2IpIHtcbiAgICAgIGlmKHNiLmF1ZGlvKSB7XG4gICAgICAgICAgLy9kZXRhY2ggc291cmNlYnVmZmVyIGZyb20gTWVkaWEgU291cmNlXG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IuYXVkaW8pO1xuICAgICAgICAgIHNiLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgaWYoc2IudmlkZW8pIHtcbiAgICAgICAgICAvL2RldGFjaCBzb3VyY2VidWZmZXIgZnJvbSBNZWRpYSBTb3VyY2VcbiAgICAgICAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZVNvdXJjZUJ1ZmZlcihzYi52aWRlbyk7XG4gICAgICAgICAgc2IudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICAvLyByZW1vdmUgdmlkZW8gbGlzdGVuZXJcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLHRoaXMub252c2Vla2luZyk7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsdGhpcy5vbnZzZWVrZWQpO1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsdGhpcy5vbnZtZXRhZGF0YSk7XG4gICAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9udnNlZWtlZCA9IHRoaXMub252bWV0YWRhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICB9XG5cbiAgc3RhcnQoKSB7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICB0aGlzLnN0YXRlID0gU1RBUlRJTkc7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBzdG9wKCkge1xuICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgfVxuICAgIHRoaXMudGltZXIgPSB1bmRlZmluZWQ7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgcG9zLGxvYWRMZXZlbCxsb2FkTGV2ZWxEZXRhaWxzLGZyYWdJZHg7XG4gICAgc3dpdGNoKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgLy8gLTEgOiBndWVzcyBzdGFydCBMZXZlbCBieSBkb2luZyBhIGJpdHJhdGUgdGVzdCBieSBsb2FkaW5nIGZpcnN0IGZyYWdtZW50IG9mIGxvd2VzdCBxdWFsaXR5IGxldmVsXG4gICAgICAgICAgdGhpcy5zdGFydExldmVsID0gMDtcbiAgICAgICAgICB0aGlzLmZyYWdtZW50Qml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFdBSVRJTkdfTEVWRUw7XG4gICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIElETEU6XG4gICAgICAgIC8vIGhhbmRsZSBlbmQgb2YgaW1tZWRpYXRlIHN3aXRjaGluZyBpZiBuZWVkZWRcbiAgICAgICAgaWYodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgICAgICB0aGlzLmltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgY2FuZGlkYXRlIGZyYWdtZW50IHRvIGJlIGxvYWRlZCwgYmFzZWQgb24gY3VycmVudCBwb3NpdGlvbiBhbmRcbiAgICAgICAgLy8gIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgLy8gIGVuc3VyZSA2MHMgb2YgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBub3QgeWV0IGxvYWRlZCBhbnkgZnJhZ21lbnQsIHN0YXJ0IGxvYWRpbmcgZnJvbSBzdGFydCBwb3NpdGlvblxuICAgICAgICBpZih0aGlzLmxvYWRlZG1ldGFkYXRhKSB7XG4gICAgICAgICAgcG9zID0gdGhpcy52aWRlby5jdXJyZW50VGltZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm5leHRMb2FkUG9zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgbG9hZCBsZXZlbFxuICAgICAgICBpZih0aGlzLnN0YXJ0RnJhZ21lbnRMb2FkZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgbG9hZExldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbG9hZExldmVsID0gdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExldmVsKCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSB0aGlzLmJ1ZmZlckluZm8ocG9zKSwgYnVmZmVyTGVuID0gYnVmZmVySW5mby5sZW4sIGJ1ZmZlckVuZCA9IGJ1ZmZlckluZm8uZW5kO1xuICAgICAgICAvLyBjb21wdXRlIG1heCBCdWZmZXIgTGVuZ3RoIHRoYXQgd2UgY291bGQgZ2V0IGZyb20gdGhpcyBsb2FkIGxldmVsLCBiYXNlZCBvbiBsZXZlbCBiaXRyYXRlLiBkb24ndCBidWZmZXIgbW9yZSB0aGFuIDYwIE1CIGFuZCBtb3JlIHRoYW4gMzBzXG4gICAgICAgIHZhciBtYXhCdWZMZW4gPSBNYXRoLm1pbig4KjYwKjEwMDAqMTAwMC90aGlzLmxldmVsc1tsb2FkTGV2ZWxdLmJpdHJhdGUsMzApO1xuICAgICAgICAvLyBpZiBidWZmZXIgbGVuZ3RoIGlzIGxlc3MgdGhhbiBtYXhCdWZMZW4gdHJ5IHRvIGxvYWQgYSBuZXcgZnJhZ21lbnRcbiAgICAgICAgaWYoYnVmZmVyTGVuIDwgbWF4QnVmTGVuKSB7XG4gICAgICAgICAgaWYobG9hZExldmVsICE9PSB0aGlzLmxldmVsKSB7XG4gICAgICAgICAgICAvLyBzZXQgbmV3IGxldmVsIHRvIHBsYXlsaXN0IGxvYWRlciA6IHRoaXMgd2lsbCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZCBpZiBuZWVkZWRcbiAgICAgICAgICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsID0gbG9hZExldmVsO1xuICAgICAgICAgICAgLy8gdGVsbCBkZW11eGVyIHRoYXQgd2Ugd2lsbCBzd2l0Y2ggbGV2ZWwgKHRoaXMgd2lsbCBmb3JjZSBpbml0IHNlZ21lbnQgdG8gYmUgcmVnZW5lcmF0ZWQpXG4gICAgICAgICAgICBpZiAodGhpcy5kZW11eGVyKSB7XG4gICAgICAgICAgICAgIHRoaXMuZGVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBsb2FkTGV2ZWxEZXRhaWxzID0gdGhpcy5sZXZlbHNbbG9hZExldmVsXS5kZXRhaWxzO1xuICAgICAgICAgIC8vIGlmIGxldmVsIGRldGFpbHMgcmV0cmlldmVkIHlldCwgc3dpdGNoIHN0YXRlIGFuZCB3YWl0IGZvciBsZXZlbCByZXRyaWV2YWxcbiAgICAgICAgICBpZih0eXBlb2YgbG9hZExldmVsRGV0YWlscyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBXQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgdmFyIGZyYWdtZW50cyA9IGxvYWRMZXZlbERldGFpbHMuZnJhZ21lbnRzLCBmcmFnLCBzbGlkaW5nID0gbG9hZExldmVsRGV0YWlscy5zbGlkaW5nLCBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCArIHNsaWRpbmc7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAvLyBpbiBjYXNlIG9mIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byBlbnN1cmUgdGhhdCByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgbm90IGxvY2F0ZWQgYmVmb3JlIHBsYXlsaXN0IHN0YXJ0XG4gICAgICAgICAgaWYoYnVmZmVyRW5kIDwgc3RhcnQpIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coJ3JlcXVlc3RlZCBwb3NpdGlvbjonICsgYnVmZmVyRW5kICsgJyBpcyBiZWZvcmUgc3RhcnQgb2YgcGxheWxpc3QsIHJlc2V0IHZpZGVvIHBvc2l0aW9uIHRvIHN0YXJ0OicgKyBzdGFydCk7XG4gICAgICAgICAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lID0gc3RhcnQgKyAwLjAxO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vbG9vayBmb3IgZnJhZ21lbnRzIG1hdGNoaW5nIHdpdGggY3VycmVudCBwbGF5IHBvc2l0aW9uXG4gICAgICAgICAgZm9yIChmcmFnSWR4ID0gMDsgZnJhZ0lkeCA8IGZyYWdtZW50cy5sZW5ndGggOyBmcmFnSWR4KyspIHtcbiAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeF07XG4gICAgICAgICAgICBzdGFydCA9IGZyYWcuc3RhcnQrc2xpZGluZztcbiAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5XG4gICAgICAgICAgICBpZihzdGFydCA8PSBidWZmZXJFbmQgJiYgKHN0YXJ0ICsgZnJhZy5kdXJhdGlvbikgPiBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgU04gbWF0Y2hpbmcgd2l0aCBwb3M6JyArICBidWZmZXJFbmQgKyAnOicgKyBmcmFnLnNuKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZnJhZ0lkeCA+PSAwICYmIGZyYWdJZHggPCBmcmFnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZih0aGlzLmZyYWcgJiYgZnJhZy5zbiA9PT0gdGhpcy5mcmFnLnNuKSB7XG4gICAgICAgICAgICAgIGlmKGZyYWdJZHggPT09IChmcmFnbWVudHMubGVuZ3RoIC0xKSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGFyZSBhdCB0aGUgZW5kIG9mIHRoZSBwbGF5bGlzdCBhbmQgd2UgYWxyZWFkeSBsb2FkZWQgbGFzdCBmcmFnbWVudCwgZG9uJ3QgZG8gYW55dGhpbmdcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHgrMV07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnU04ganVzdCBsb2FkZWQsIGxvYWQgbmV4dCBvbmU6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsb2dnZXIubG9nKCdMb2FkaW5nICAgICAgICcgKyBmcmFnLnNuICsgJyBvZiBbJyArIGZyYWdtZW50c1swXS5zbiArICcsJyArIGZyYWdtZW50c1tmcmFnbWVudHMubGVuZ3RoLTFdLnNuICsgJ10sbGV2ZWwgJyAgKyBsb2FkTGV2ZWwpO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCcgICAgICBsb2FkaW5nIGZyYWcgJyArIGkgKycscG9zL2J1ZkVuZDonICsgcG9zLnRvRml4ZWQoMykgKyAnLycgKyBidWZmZXJFbmQudG9GaXhlZCgzKSk7XG5cbiAgICAgICAgICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgICAgICAgICB0aGlzLmxldmVsID0gbG9hZExldmVsO1xuICAgICAgICAgICAgdGhpcy5mcmFnbWVudExvYWRlci5sb2FkKGZyYWcsbG9hZExldmVsKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBMT0FESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgTE9BRElORzpcbiAgICAgICAgLy8gbm90aGluZyB0byBkbywgd2FpdCBmb3IgZnJhZ21lbnQgcmV0cmlldmFsXG4gICAgICBjYXNlIFdBSVRJTkdfTEVWRUw6XG4gICAgICAgIC8vIG5vdGhpbmcgdG8gZG8sIHdhaXQgZm9yIGxldmVsIHJldHJpZXZhbFxuICAgICAgY2FzZSBQQVJTSU5HOlxuICAgICAgICAvLyBub3RoaW5nIHRvIGRvLCB3YWl0IGZvciBmcmFnbWVudCBiZWluZyBwYXJzZWRcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFBBUlNFRDpcbiAgICAgIGNhc2UgQVBQRU5ESU5HOlxuICAgICAgICBpZiAodGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgICAvLyBpZiBNUDQgc2VnbWVudCBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3Mgbm90aGluZyB0byBkb1xuICAgICAgICAgIGlmKCh0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpby51cGRhdGluZykgfHxcbiAgICAgICAgICAgICAodGhpcy5zb3VyY2VCdWZmZXIudmlkZW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIudmlkZW8udXBkYXRpbmcpKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3NiIGFwcGVuZCBpbiBwcm9ncmVzcycpO1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgTVA0IHNlZ21lbnRzIGxlZnQgdG8gYXBwZW5kXG4gICAgICAgICAgfSBlbHNlIGlmKHRoaXMubXA0c2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VnbWVudCA9IHRoaXMubXA0c2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHRoaXMuc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0uYXBwZW5kQnVmZmVyKHNlZ21lbnQuZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAvLyBpbiBjYXNlIGFueSBlcnJvciBvY2N1cmVkIHdoaWxlIGFwcGVuZGluZywgcHV0IGJhY2sgc2VnbWVudCBpbiBtcDRzZWdtZW50cyB0YWJsZVxuICAgICAgICAgICAgICBsb2dnZXIubG9nKCdlcnJvciB3aGlsZSB0cnlpbmcgdG8gYXBwZW5kIGJ1ZmZlciwgYnVmZmVyIG1pZ2h0IGJlIGZ1bGwsIHRyeSBhcHBlbmRpbmcgbGF0ZXInKTtcbiAgICAgICAgICAgICAgdGhpcy5tcDRzZWdtZW50cy51bnNoaWZ0KHNlZ21lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IEFQUEVORElORztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEJVRkZFUl9GTFVTSElORzpcbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGFsbCBidWZmZXIgcmFuZ2VzIHRvIGZsdXNoXG4gICAgICAgIHdoaWxlKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgcmFuZ2UgPSB0aGlzLmZsdXNoUmFuZ2VbMF07XG4gICAgICAgICAgLy8gZmx1c2hCdWZmZXIgd2lsbCBhYm9ydCBhbnkgYnVmZmVyIGFwcGVuZCBpbiBwcm9ncmVzcyBhbmQgZmx1c2ggQXVkaW8vVmlkZW8gQnVmZmVyXG4gICAgICAgICAgaWYodGhpcy5mbHVzaEJ1ZmZlcihyYW5nZS5zdGFydCxyYW5nZS5lbmQpKSB7XG4gICAgICAgICAgICAvLyByYW5nZSBmbHVzaGVkLCByZW1vdmUgZnJvbSBmbHVzaCBhcnJheVxuICAgICAgICAgICAgdGhpcy5mbHVzaFJhbmdlLnNoaWZ0KCk7XG4gICAgICAgICAgICAvLyByZXNldCBmbHVzaCBjb3VudGVyXG4gICAgICAgICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGZsdXNoIGluIHByb2dyZXNzLCBjb21lIGJhY2sgbGF0ZXJcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBtb3ZlIHRvIElETEUgb25jZSBmbHVzaCBjb21wbGV0ZS4gdGhpcyBzaG91bGQgdHJpZ2dlciBuZXcgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICAgICAgICB9XG4gICAgICAgICAvKiBpZiBub3QgZXZlcnl0aGluZyBmbHVzaGVkLCBzdGF5IGluIEJVRkZFUl9GTFVTSElORyBzdGF0ZS4gd2Ugd2lsbCBjb21lIGJhY2sgaGVyZVxuICAgICAgICAgICAgZWFjaCB0aW1lIHNvdXJjZUJ1ZmZlciB1cGRhdGVlbmQoKSBjYWxsYmFjayB3aWxsIGJlIHRyaWdnZXJlZFxuICAgICAgICAgICAgKi9cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLy8gY2hlY2svdXBkYXRlIGN1cnJlbnQgZnJhZ21lbnRcbiAgICB0aGlzLl9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpO1xuICB9XG5cbiAgIGJ1ZmZlckluZm8ocG9zKSB7XG4gICAgdmFyIHYgPSB0aGlzLnZpZGVvLFxuICAgICAgICBidWZmZXJlZCA9IHYuYnVmZmVyZWQsXG4gICAgICAgIGJ1ZmZlckxlbixcbiAgICAgICAgLy8gYnVmZmVyU3RhcnQgYW5kIGJ1ZmZlckVuZCBhcmUgYnVmZmVyIGJvdW5kYXJpZXMgYXJvdW5kIGN1cnJlbnQgdmlkZW8gcG9zaXRpb25cbiAgICAgICAgYnVmZmVyU3RhcnQsYnVmZmVyRW5kLFxuICAgICAgICBpO1xuICAgIHZhciBidWZmZXJlZDIgPSBbXTtcbiAgICAvLyB0aGVyZSBtaWdodCBiZSBzb21lIHNtYWxsIGhvbGVzIGJldHdlZW4gYnVmZmVyIHRpbWUgcmFuZ2VcbiAgICAvLyBjb25zaWRlciB0aGF0IGhvbGVzIHNtYWxsZXIgdGhhbiAzMDAgbXMgYXJlIGlycmVsZXZhbnQgYW5kIGJ1aWxkIGFub3RoZXJcbiAgICAvLyBidWZmZXIgdGltZSByYW5nZSByZXByZXNlbnRhdGlvbnMgdGhhdCBkaXNjYXJkcyB0aG9zZSBob2xlc1xuICAgIGZvcihpID0gMCA7IGkgPCBidWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgIC8vbG9nZ2VyLmxvZygnYnVmIHN0YXJ0L2VuZDonICsgYnVmZmVyZWQuc3RhcnQoaSkgKyAnLycgKyBidWZmZXJlZC5lbmQoaSkpO1xuICAgICAgaWYoKGJ1ZmZlcmVkMi5sZW5ndGgpICYmIChidWZmZXJlZC5zdGFydChpKSAtIGJ1ZmZlcmVkMltidWZmZXJlZDIubGVuZ3RoLTFdLmVuZCApIDwgMC4zKSB7XG4gICAgICAgIGJ1ZmZlcmVkMltidWZmZXJlZDIubGVuZ3RoLTFdLmVuZCA9IGJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJ1ZmZlcmVkMi5wdXNoKHtzdGFydCA6IGJ1ZmZlcmVkLnN0YXJ0KGkpLGVuZCA6IGJ1ZmZlcmVkLmVuZChpKX0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvcihpID0gMCwgYnVmZmVyTGVuID0gMCwgYnVmZmVyU3RhcnQgPSBidWZmZXJFbmQgPSBwb3MgOyBpIDwgYnVmZmVyZWQyLmxlbmd0aCA7IGkrKykge1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZigocG9zKzAuMykgPj0gYnVmZmVyZWQyW2ldLnN0YXJ0ICYmIHBvcyA8IGJ1ZmZlcmVkMltpXS5lbmQpIHtcbiAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyZWQyW2ldLnN0YXJ0O1xuICAgICAgICBidWZmZXJFbmQgPSBidWZmZXJlZDJbaV0uZW5kICsgMC4zO1xuICAgICAgICBidWZmZXJMZW4gPSBidWZmZXJFbmQgLSBwb3M7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7bGVuIDogYnVmZmVyTGVuLCBzdGFydCA6IGJ1ZmZlclN0YXJ0LCBlbmQgOiBidWZmZXJFbmR9O1xuICB9XG5cblxuICBnZXRCdWZmZXJSYW5nZShwb3NpdGlvbikge1xuICAgIHZhciBpLHJhbmdlO1xuICAgIGZvciAoaSA9IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoLTE7IGkgPj0wIDsgaS0tKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZihwb3NpdGlvbiA+PSByYW5nZS5zdGFydCAmJiBwb3NpdGlvbiA8PSByYW5nZS5lbmQpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgZ2V0IGN1cnJlbnRMZXZlbCgpIHtcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUpO1xuICAgICAgaWYocmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIGdldCBuZXh0QnVmZmVyUmFuZ2UoKSB7XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgLy8gZmlyc3QgZ2V0IGVuZCByYW5nZSBvZiBjdXJyZW50IGZyYWdtZW50XG4gICAgICByZXR1cm4gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZSh0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgZm9sbG93aW5nQnVmZmVyUmFuZ2UocmFuZ2UpIHtcbiAgICBpZihyYW5nZSkge1xuICAgICAgLy8gdHJ5IHRvIGdldCByYW5nZSBvZiBuZXh0IGZyYWdtZW50ICg1MDBtcyBhZnRlciB0aGlzIHJhbmdlKVxuICAgICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyUmFuZ2UocmFuZ2UuZW5kKzAuNSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cblxuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHZhciByYW5nZSA9IHRoaXMubmV4dEJ1ZmZlclJhbmdlO1xuICAgIGlmKHJhbmdlKSB7XG4gICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgfVxuXG4gIGlzQnVmZmVyZWQocG9zaXRpb24pIHtcbiAgICB2YXIgdiA9IHRoaXMudmlkZW8sYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkO1xuICAgIGZvcih2YXIgaSA9IDAgOyBpIDwgYnVmZmVyZWQubGVuZ3RoIDsgaSsrKSB7XG4gICAgICBpZihwb3NpdGlvbiA+PSBidWZmZXJlZC5zdGFydChpKSAmJiBwb3NpdGlvbiA8PSBidWZmZXJlZC5lbmQoaSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIF9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpIHtcbiAgICB2YXIgcmFuZ2VDdXJyZW50O1xuICAgIGlmKHRoaXMudmlkZW8gJiYgdGhpcy52aWRlby5zZWVraW5nID09PSBmYWxzZSAmJiB0aGlzLmlzQnVmZmVyZWQodGhpcy52aWRlby5jdXJyZW50VGltZSkpIHtcbiAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy52aWRlby5jdXJyZW50VGltZSk7XG4gICAgfVxuXG4gICAgaWYocmFuZ2VDdXJyZW50ICYmIHJhbmdlQ3VycmVudC5mcmFnICE9PSB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICB0aGlzLmZyYWdDdXJyZW50ID0gcmFuZ2VDdXJyZW50LmZyYWc7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfQ0hBTkdFRCwgeyBmcmFnIDogdGhpcy5mcmFnQ3VycmVudCB9KTtcbiAgICB9XG4gIH1cblxuLypcbiAgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MsIGFuZCBmbHVzaCBhbGwgYnVmZmVyZWQgZGF0YVxuICByZXR1cm4gdHJ1ZSBvbmNlIGV2ZXJ5dGhpbmcgaGFzIGJlZW4gZmx1c2hlZC5cbiAgc291cmNlQnVmZmVyLmFib3J0KCkgYW5kIHNvdXJjZUJ1ZmZlci5yZW1vdmUoKSBhcmUgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnNcbiAgdGhlIGlkZWEgaXMgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIGZyb20gdGljaygpIHRpbWVyIGFuZCBjYWxsIGl0IGFnYWluIHVudGlsIGFsbCByZXNvdXJjZXMgaGF2ZSBiZWVuIGNsZWFuZWRcbiAgdGhlIHRpbWVyIGlzIHJlYXJtZWQgdXBvbiBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgZXZlbnQsIHNvIHRoaXMgc2hvdWxkIGJlIG9wdGltYWxcbiovXG4gIGZsdXNoQnVmZmVyKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpIHtcbiAgICB2YXIgc2IsaSxidWZTdGFydCxidWZFbmQsIGZsdXNoU3RhcnQsIGZsdXNoRW5kO1xuICAgIC8vbG9nZ2VyLmxvZygnZmx1c2hCdWZmZXIscG9zL3N0YXJ0L2VuZDogJyArIHRoaXMudmlkZW8uY3VycmVudFRpbWUgKyAnLycgKyBzdGFydE9mZnNldCArICcvJyArIGVuZE9mZnNldCk7XG4gICAgLy8gc2FmZWd1YXJkIHRvIGF2b2lkIGluZmluaXRlIGxvb3BpbmdcbiAgICBpZih0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrIDwgMip0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIGlmKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvcihpID0gMCA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgICAgIGJ1ZlN0YXJ0ID0gc2IuYnVmZmVyZWQuc3RhcnQoaSk7XG4gICAgICAgICAgICBidWZFbmQgPSBzYi5idWZmZXJlZC5lbmQoaSk7XG4gICAgICAgICAgICBmbHVzaFN0YXJ0ID0gTWF0aC5tYXgoYnVmU3RhcnQsc3RhcnRPZmZzZXQpO1xuICAgICAgICAgICAgZmx1c2hFbmQgPSBNYXRoLm1pbihidWZFbmQsZW5kT2Zmc2V0KTtcbiAgICAgICAgICAgIC8qIHNvbWV0aW1lcyBzb3VyY2VidWZmZXIucmVtb3ZlKCkgZG9lcyBub3QgZmx1c2hcbiAgICAgICAgICAgICAgIHRoZSBleGFjdCBleHBlY3RlZCB0aW1lIHJhbmdlLlxuICAgICAgICAgICAgICAgdG8gYXZvaWQgcm91bmRpbmcgaXNzdWVzL2luZmluaXRlIGxvb3AsXG4gICAgICAgICAgICAgICBvbmx5IGZsdXNoIGJ1ZmZlciByYW5nZSBvZiBsZW5ndGggZ3JlYXRlciB0aGFuIDUwMG1zLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmKGZsdXNoRW5kIC0gZmx1c2hTdGFydCA+IDAuNSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKCdmbHVzaCAnICsgdHlwZSArICcgWycgKyBmbHVzaFN0YXJ0ICsgJywnICsgZmx1c2hFbmQgKyAnXSwgb2YgWycgKyBidWZTdGFydCArICcsJyArIGJ1ZkVuZCArICddLCBwb3M6JyArIHRoaXMudmlkZW8uY3VycmVudFRpbWUpO1xuICAgICAgICAgICAgICBzYi5yZW1vdmUoZmx1c2hTdGFydCxmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZTtcbiAgICBmb3IgKGkgPSAwIDsgaSA8IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoIDsgaSsrKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZih0aGlzLmlzQnVmZmVyZWQoKHJhbmdlLnN0YXJ0ICsgcmFuZ2UuZW5kKS8yKSkge1xuICAgICAgICBuZXdSYW5nZS5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IG5ld1JhbmdlO1xuXG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGZsdXNoZWQnKTtcbiAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWQgIVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgICAvKlxuICAgICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCA6XG4gICAgICAgLSBwYXVzZSBwbGF5YmFjayBpZiBwbGF5aW5nXG4gICAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgICAgLSBhbmQgdHJpZ2dlciBhIGJ1ZmZlciBmbHVzaFxuICAgICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoKCkge1xuICAgIGlmKCF0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSB0cnVlO1xuICAgICAgdGhpcy5wcmV2aW91c2x5UGF1c2VkID0gdGhpcy52aWRlby5wYXVzZWQ7XG4gICAgICB0aGlzLnZpZGVvLnBhdXNlKCk7XG4gICAgfVxuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuYWJvcnQoKTtcbiAgICAvLyBmbHVzaCBldmVyeXRoaW5nXG4gICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goeyBzdGFydCA6IDAsIGVuZCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgIC8vIHRyaWdnZXIgYSBzb3VyY2VCdWZmZXIgZmx1c2hcbiAgICB0aGlzLnN0YXRlID0gQlVGRkVSX0ZMVVNISU5HO1xuICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbi8qXG4gICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIGVuZCwgYWZ0ZXIgbmV3IGZyYWdtZW50IGhhcyBiZWVuIGJ1ZmZlcmVkIDpcbiAgICAtIG51ZGdlIHZpZGVvIGRlY29kZXIgYnkgc2xpZ2h0bHkgYWRqdXN0aW5nIHZpZGVvIGN1cnJlbnRUaW1lXG4gICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKSB7XG4gICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSBmYWxzZTtcbiAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lLT0wLjAwMDE7XG4gICAgaWYoIXRoaXMucHJldmlvdXNseVBhdXNlZCkge1xuICAgICAgdGhpcy52aWRlby5wbGF5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExldmVsU3dpdGNoKCkge1xuICAgIC8qIHRyeSB0byBzd2l0Y2ggQVNBUCB3aXRob3V0IGJyZWFraW5nIHZpZGVvIHBsYXliYWNrIDpcbiAgICAgICBpbiBvcmRlciB0byBlbnN1cmUgc21vb3RoIGJ1dCBxdWljayBsZXZlbCBzd2l0Y2hpbmcsXG4gICAgICB3ZSBuZWVkIHRvIGZpbmQgdGhlIG5leHQgZmx1c2hhYmxlIGJ1ZmZlciByYW5nZVxuICAgICAgd2Ugc2hvdWxkIHRha2UgaW50byBhY2NvdW50IG5ldyBzZWdtZW50IGZldGNoIHRpbWVcbiAgICAqL1xuICAgIHZhciBmZXRjaGRlbGF5LGN1cnJlbnRSYW5nZSxuZXh0UmFuZ2U7XG5cbiAgICBjdXJyZW50UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUpO1xuICAgIGlmKGN1cnJlbnRSYW5nZSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7IHN0YXJ0IDogMCwgZW5kIDogY3VycmVudFJhbmdlLnN0YXJ0LTF9KTtcbiAgICB9XG5cbiAgICBpZighdGhpcy52aWRlby5wYXVzZWQpIHtcbiAgICAgIC8vIGFkZCBhIHNhZmV0eSBkZWxheSBvZiAxc1xuICAgICAgZmV0Y2hkZWxheT10aGlzLmxldmVsQ29udHJvbGxlci5uZXh0RmV0Y2hEdXJhdGlvbigpKzE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZldGNoZGVsYXk6JytmZXRjaGRlbGF5KTtcbiAgICAvLyBmaW5kIGJ1ZmZlciByYW5nZSB0aGF0IHdpbGwgYmUgcmVhY2hlZCBvbmNlIG5ldyBmcmFnbWVudCB3aWxsIGJlIGZldGNoZWRcbiAgICBuZXh0UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUgKyBmZXRjaGRlbGF5KTtcbiAgICBpZihuZXh0UmFuZ2UpIHtcbiAgICAgIC8vIHdlIGNhbiBmbHVzaCBidWZmZXIgcmFuZ2UgZm9sbG93aW5nIHRoaXMgb25lIHdpdGhvdXQgc3RhbGxpbmcgcGxheWJhY2tcbiAgICAgIG5leHRSYW5nZSA9IHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UobmV4dFJhbmdlKTtcbiAgICAgIGlmKG5leHRSYW5nZSkge1xuICAgICAgICAvLyBmbHVzaCBwb3NpdGlvbiBpcyB0aGUgc3RhcnQgcG9zaXRpb24gb2YgdGhpcyBuZXcgYnVmZmVyXG4gICAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHsgc3RhcnQgOiBuZXh0UmFuZ2Uuc3RhcnQsIGVuZCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgfVxuICAgIH1cbiAgICBpZih0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICAvLyB0cmlnZ2VyIGEgc291cmNlQnVmZmVyIGZsdXNoXG4gICAgICB0aGlzLnN0YXRlID0gQlVGRkVSX0ZMVVNISU5HO1xuICAgICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbk1TRUF0dGFjaGVkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLnZpZGVvID0gZGF0YS52aWRlbztcbiAgICB0aGlzLm1lZGlhU291cmNlID0gZGF0YS5tZWRpYVNvdXJjZTtcbiAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9uVmlkZW9TZWVraW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9uVmlkZW9TZWVrZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udm1ldGFkYXRhID0gdGhpcy5vblZpZGVvTWV0YWRhdGEuYmluZCh0aGlzKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLHRoaXMub252c2Vla2luZyk7XG4gICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLHRoaXMub252c2Vla2VkKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJyx0aGlzLm9udm1ldGFkYXRhKTtcbiAgICBpZih0aGlzLmxldmVscykge1xuICAgICAgdGhpcy5zdGFydCgpO1xuICAgIH1cbiAgfVxuICBvblZpZGVvU2Vla2luZygpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSBMT0FESU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50bHkgbG9hZGVkIGZyYWdtZW50IGlzIGluc2lkZSBidWZmZXIuXG4gICAgICAvL2lmIG91dHNpZGUsIGNhbmNlbCBmcmFnbWVudCBsb2FkaW5nLCBvdGhlcndpc2UgZG8gbm90aGluZ1xuICAgICAgaWYodGhpcy5idWZmZXJJbmZvKHRoaXMudmlkZW8uY3VycmVudFRpbWUpLmxlbiA9PT0gMCkge1xuICAgICAgICBsb2dnZXIubG9nKCdzZWVraW5nIG91dHNpZGUgb2YgYnVmZmVyIHdoaWxlIGZyYWdtZW50IGxvYWQgaW4gcHJvZ3Jlc3MsIGNhbmNlbCBmcmFnbWVudCBsb2FkJyk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgcHJvY2Vzc2luZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25WaWRlb1NlZWtlZCgpIHtcbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIEZSQUdNRU5UX1BMQVlJTkcgdHJpZ2dlcmluZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25WaWRlb01ldGFkYXRhKCkge1xuICAgICAgaWYodGhpcy52aWRlby5jdXJyZW50VGltZSAhPT0gdGhpcy5zdGFydFBvc2l0aW9uKSB7XG4gICAgICAgIHRoaXMudmlkZW8uY3VycmVudFRpbWUgPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgfVxuICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSB0cnVlO1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChldmVudCxkYXRhKSB7XG4gICAgdGhpcy5hdWRpb2NvZGVjc3dpdGNoID0gZGF0YS5hdWRpb2NvZGVjc3dpdGNoO1xuICAgIGlmKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCkge1xuICAgICAgbG9nZ2VyLmxvZygnYm90aCBBQUMvSEUtQUFDIGF1ZGlvIGZvdW5kIGluIGxldmVsczsgZGVjbGFyaW5nIGF1ZGlvIGNvZGVjIGFzIEhFLUFBQycpO1xuICAgIH1cbiAgICB0aGlzLmxldmVscyA9IGRhdGEubGV2ZWxzO1xuICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuc3RhcnRGcmFnbWVudExvYWRlZCA9IGZhbHNlO1xuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIHRoaXMuc3RhcnQoKTtcbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgZnJhZ21lbnRzID0gZGF0YS5kZXRhaWxzLmZyYWdtZW50cyxkdXJhdGlvbiA9IGRhdGEuZGV0YWlscy50b3RhbGR1cmF0aW9uO1xuICAgIGxvZ2dlci5sb2coJ2xldmVsICcgKyBkYXRhLmxldmVsSWQgKyAnIGxvYWRlZCBbJyArIGZyYWdtZW50c1swXS5zbiArICcsJyArIGZyYWdtZW50c1tmcmFnbWVudHMubGVuZ3RoLTFdLnNuICsgJ10sZHVyYXRpb246JyArIGR1cmF0aW9uKTtcblxuICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW2RhdGEubGV2ZWxJZF0sc2xpZGluZyA9IDAsIGxldmVsQ3VycmVudCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgIC8vIGNoZWNrIGlmIHBsYXlsaXN0IGlzIGFscmVhZHkgbG9hZGVkIChpZiB5ZXMsIGl0IHNob3VsZCBiZSBhIGxpdmUgcGxheWxpc3QpXG4gICAgaWYobGV2ZWxDdXJyZW50ICYmIGxldmVsQ3VycmVudC5kZXRhaWxzICYmIGxldmVsQ3VycmVudC5kZXRhaWxzLmxpdmUpIHtcbiAgICAgIC8vICBwbGF5bGlzdCBzbGlkaW5nIGlzIHRoZSBzdW0gb2YgOiBjdXJyZW50IHBsYXlsaXN0IHNsaWRpbmcgKyBzbGlkaW5nIG9mIG5ldyBwbGF5bGlzdCBjb21wYXJlZCB0byBjdXJyZW50IG9uZVxuICAgICAgc2xpZGluZyA9IGxldmVsQ3VycmVudC5kZXRhaWxzLnNsaWRpbmc7XG4gICAgICAvLyBjaGVjayBzbGlkaW5nIG9mIHVwZGF0ZWQgcGxheWxpc3QgYWdhaW5zdCBjdXJyZW50IG9uZSA6XG4gICAgICAvLyBhbmQgZmluZCBpdHMgcG9zaXRpb24gaW4gY3VycmVudCBwbGF5bGlzdFxuICAgICAgLy9sb2dnZXIubG9nKFwiZnJhZ21lbnRzWzBdLnNuL3RoaXMubGV2ZWwvbGV2ZWxDdXJyZW50LmRldGFpbHMuZnJhZ21lbnRzWzBdLnNuOlwiICsgZnJhZ21lbnRzWzBdLnNuICsgXCIvXCIgKyB0aGlzLmxldmVsICsgXCIvXCIgKyBsZXZlbEN1cnJlbnQuZGV0YWlscy5mcmFnbWVudHNbMF0uc24pO1xuICAgICAgdmFyIFNOZGlmZiA9IGZyYWdtZW50c1swXS5zbiAtIGxldmVsQ3VycmVudC5kZXRhaWxzLmZyYWdtZW50c1swXS5zbjtcbiAgICAgIGlmKFNOZGlmZiA+PTApIHtcbiAgICAgICAgLy8gcG9zaXRpdmUgc2xpZGluZyA6IG5ldyBwbGF5bGlzdCBzbGlkaW5nIHdpbmRvdyBpcyBhZnRlciBwcmV2aW91cyBvbmVcbiAgICAgICAgc2xpZGluZyArPSBsZXZlbEN1cnJlbnQuZGV0YWlscy5mcmFnbWVudHNbU05kaWZmXS5zdGFydDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG5lZ2F0aXZlIHNsaWRpbmc6IG5ldyBwbGF5bGlzdCBzbGlkaW5nIHdpbmRvdyBpcyBiZWZvcmUgcHJldmlvdXMgb25lXG4gICAgICAgIHNsaWRpbmcgLT0gZnJhZ21lbnRzWy1TTmRpZmZdLnN0YXJ0O1xuICAgICAgfVxuICAgICAgbG9nZ2VyLmxvZygnbGl2ZSBwbGF5bGlzdCBzbGlkaW5nOicgKyBzbGlkaW5nLnRvRml4ZWQoMykpO1xuICAgIH1cbiAgICAvLyBvdmVycmlkZSBsZXZlbCBpbmZvXG4gICAgbGV2ZWwuZGV0YWlscyA9IGRhdGEuZGV0YWlscztcbiAgICBsZXZlbC5kZXRhaWxzLnNsaWRpbmcgPSBzbGlkaW5nO1xuICAgIHRoaXMuZGVtdXhlci5zZXREdXJhdGlvbihkdXJhdGlvbik7XG4gICAgaWYodGhpcy5zdGFydExldmVsTG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tM1xuICAgICAgaWYoZGF0YS5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCxkdXJhdGlvbiAtIDMgKiBkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gMDtcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IHRydWU7XG4gICAgfVxuICAgIC8vIG9ubHkgc3dpdGNoIGJhdGNrIHRvIElETEUgc3RhdGUgaWYgd2Ugd2VyZSB3YWl0aW5nIGZvciBsZXZlbCB0byBzdGFydCBkb3dubG9hZGluZyBhIG5ldyBmcmFnbWVudFxuICAgIGlmKHRoaXMuc3RhdGUgPT09IFdBSVRJTkdfTEVWRUwpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IExPQURJTkcpIHtcbiAgICAgIGlmKHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIC4uLiB3ZSBqdXN0IGxvYWRlZCBhIGZyYWdtZW50IHRvIGRldGVybWluZSBhZGVxdWF0ZSBzdGFydCBiaXRyYXRlIGFuZCBpbml0aWFsaXplIGF1dG9zd2l0Y2ggYWxnb1xuICAgICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICAgICAgdGhpcy5mcmFnbWVudEJpdHJhdGVUZXN0ID0gZmFsc2U7XG4gICAgICAgIGRhdGEuc3RhdHMudHBhcnNlZCA9IGRhdGEuc3RhdHMudGJ1ZmZlcmVkID0gbmV3IERhdGUoKTtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7IHN0YXRzIDogZGF0YS5zdGF0cywgZnJhZyA6IHRoaXMuZnJhZ30pO1xuICAgICAgICB0aGlzLmZyYWcgPSBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHRoaXMuZGVtdXhlci5wdXNoKGRhdGEucGF5bG9hZCx0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5hdWRpb0NvZGVjLHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWMsdGhpcy5mcmFnLnN0YXJ0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc3RhcnRGcmFnbWVudExvYWRlZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgb25Jbml0U2VnbWVudChldmVudCxkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY29kZWNzIGhhdmUgYmVlbiBleHBsaWNpdGVseSBkZWZpbmVkIGluIHRoZSBtYXN0ZXIgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWw7XG4gICAgLy8gaWYgeWVzIHVzZSB0aGVzZSBvbmVzIGluc3RlYWQgb2YgdGhlIG9uZXMgcGFyc2VkIGZyb20gdGhlIGRlbXV4XG4gICAgdmFyIGF1ZGlvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0udmlkZW9Db2RlYyxzYjtcbiAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGxldmVsIEEvViBjb2RlY3M6JyArIGF1ZGlvQ29kZWMgKyAnLCcgKyB2aWRlb0NvZGVjKTtcbiAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGNvZGVjczonICsgY29kZWMpO1xuICAgIC8vIGlmIHBsYXlsaXN0IGRvZXMgbm90IHNwZWNpZnkgY29kZWNzLCB1c2UgY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnRcbiAgICBpZihhdWRpb0NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgfVxuICAgIGlmKHZpZGVvQ29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICB9XG5cbiAgICAvLyBjb2RlYz1cIm1wNGEuNDAuNSxhdmMxLjQyMDAxNlwiO1xuICAgIC8vIGluIGNhc2Ugc2V2ZXJhbCBhdWRpbyBjb2RlY3MgbWlnaHQgYmUgdXNlZCwgZm9yY2UgSEUtQUFDIGZvciBhdWRpbyAoc29tZSBicm93c2VycyBkb24ndCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaClcbiAgICAvL2Rvbid0IGRvIGl0IGZvciBtb25vIHN0cmVhbXMgLi4uXG4gICAgaWYodGhpcy5hdWRpb2NvZGVjc3dpdGNoICYmIGRhdGEuYXVkaW9DaGFubmVsQ291bnQgPT09IDIgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2FuZHJvaWQnKSA9PT0gLTEgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2ZpcmVmb3gnKSA9PT0gLTEpIHtcbiAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICB9XG4gICAgaWYoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IHt9O1xuICAgICAgbG9nZ2VyLmxvZygnc2VsZWN0ZWQgQS9WIGNvZGVjcyBmb3Igc291cmNlQnVmZmVyczonICsgYXVkaW9Db2RlYyArICcsJyArIHZpZGVvQ29kZWMpO1xuICAgICAgLy8gY3JlYXRlIHNvdXJjZSBCdWZmZXIgYW5kIGxpbmsgdGhlbSB0byBNZWRpYVNvdXJjZVxuICAgICAgaWYoYXVkaW9Db2RlYykge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoJ3ZpZGVvL21wNDtjb2RlY3M9JyArIGF1ZGlvQ29kZWMpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICB9XG4gICAgICBpZih2aWRlb0NvZGVjKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIudmlkZW8gPSB0aGlzLm1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcigndmlkZW8vbXA0O2NvZGVjcz0nICsgdmlkZW9Db2RlYyk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoYXVkaW9Db2RlYykge1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6ICdhdWRpbycsIGRhdGEgOiBkYXRhLmF1ZGlvTW9vdn0pO1xuICAgIH1cbiAgICBpZih2aWRlb0NvZGVjKSB7XG4gICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogJ3ZpZGVvJywgZGF0YSA6IGRhdGEudmlkZW9Nb292fSk7XG4gICAgfVxuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25GcmFnbWVudFBhcnNpbmcoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMudHBhcnNlMiA9IERhdGUubm93KCk7XG4gICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgaWYobGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICBsZXZlbC5kZXRhaWxzLnNsaWRpbmcgPSBkYXRhLnN0YXJ0UFRTIC0gdGhpcy5mcmFnLnN0YXJ0O1xuICAgIH1cbiAgICBsb2dnZXIubG9nKCcgICAgICBwYXJzZWQgZGF0YSwgdHlwZS9zdGFydFBUUy9lbmRQVFMvc3RhcnREVFMvZW5kRFRTL3NsaWRpbmc6JyArIGRhdGEudHlwZSArICcvJyArIGRhdGEuc3RhcnRQVFMudG9GaXhlZCgzKSArICcvJyArIGRhdGEuZW5kUFRTLnRvRml4ZWQoMykgKyAnLycgKyBkYXRhLnN0YXJ0RFRTLnRvRml4ZWQoMykgKyAnLycgKyBkYXRhLmVuZERUUy50b0ZpeGVkKDMpICsgJy8nICsgbGV2ZWwuZGV0YWlscy5zbGlkaW5nLnRvRml4ZWQoMykpO1xuICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiBkYXRhLnR5cGUsIGRhdGEgOiBkYXRhLm1vb2Z9KTtcbiAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogZGF0YS50eXBlLCBkYXRhIDogZGF0YS5tZGF0fSk7XG4gICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gZGF0YS5lbmRQVFM7XG4gICAgdGhpcy5idWZmZXJSYW5nZS5wdXNoKHt0eXBlIDogZGF0YS50eXBlLCBzdGFydCA6IGRhdGEuc3RhcnRQVFMsIGVuZCA6IGRhdGEuZW5kUFRTLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkZyYWdtZW50UGFyc2VkKCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IFBBUlNFRDtcbiAgICAgIHRoaXMuc3RhdHMudHBhcnNlZCA9IG5ldyBEYXRlKCk7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZCgpIHtcbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICBpZih0aGlzLnN0YXRlID09PSBBUFBFTkRJTkcgJiYgdGhpcy5tcDRzZWdtZW50cy5sZW5ndGggPT09IDApICB7XG4gICAgICB0aGlzLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHsgc3RhdHMgOiB0aGlzLnN0YXRzLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICB9XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlckVycm9yKGV2ZW50KSB7XG4gICAgICBsb2dnZXIubG9nKCcgYnVmZmVyIGFwcGVuZCBlcnJvcjonICsgZXZlbnQpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckNvbnRyb2xsZXI7XG4iLCIvKlxuICogbGV2ZWwgY29udHJvbGxlclxuICpcbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuXG4gY2xhc3MgTGV2ZWxDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihwbGF5bGlzdExvYWRlcikge1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBwbGF5bGlzdExvYWRlcjtcbiAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmwgPSB0aGlzLm9uRnJhZ21lbnRMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gICAgLy90aGlzLnN0YXJ0TGV2ZWwgPSBzdGFydExldmVsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICB9XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSAtMTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBsZXZlbHMgPSBbXSxiaXRyYXRlU3RhcnQsaSxiaXRyYXRlU2V0PXt9LCBhYWM9ZmFsc2UsIGhlYWFjPWZhbHNlLGNvZGVjcztcbiAgICAvLyByZW1vdmUgZmFpbG92ZXIgbGV2ZWwgZm9yIG5vdyB0byBzaW1wbGlmeSB0aGUgbG9naWNcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIGlmKCFiaXRyYXRlU2V0Lmhhc093blByb3BlcnR5KGxldmVsLmJpdHJhdGUpKSB7XG4gICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgICAgYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXSA9IHRydWU7XG4gICAgICB9XG4gICAgICAvLyBkZXRlY3QgaWYgd2UgaGF2ZSBkaWZmZXJlbnQga2luZCBvZiBhdWRpbyBjb2RlY3MgdXNlZCBhbW9uZ3N0IHBsYXlsaXN0c1xuICAgICAgY29kZWNzID0gbGV2ZWwuY29kZWNzO1xuICAgICAgaWYoY29kZWNzKSB7XG4gICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEpIHtcbiAgICAgICAgICBhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpIHtcbiAgICAgICAgICBoZWFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBzdGFydCBiaXRyYXRlIGlzIHRoZSBmaXJzdCBiaXRyYXRlIG9mIHRoZSBtYW5pZmVzdFxuICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgIC8vIHNvcnQgbGV2ZWwgb24gYml0cmF0ZVxuICAgIGxldmVscy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYS5iaXRyYXRlLWIuYml0cmF0ZTtcbiAgICB9KTtcbiAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG5cbiAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICBmb3IoaT0wOyBpIDwgbGV2ZWxzLmxlbmd0aCA7IGkrKykge1xuICAgICAgaWYobGV2ZWxzW2ldLmJpdHJhdGUgPT09IGJpdHJhdGVTdGFydCkge1xuICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgbG9nZ2VyLmxvZygnbWFuaWZlc3QgbG9hZGVkLCcgKyBsZXZlbHMubGVuZ3RoICsgJyBsZXZlbChzKSBmb3VuZCwgZmlyc3QgYml0cmF0ZTonICsgYml0cmF0ZVN0YXJ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy90aGlzLl9zdGFydExldmVsID0gLTE7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogdGhpcy5fbGV2ZWxzLFxuICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0TGV2ZWwgOiB0aGlzLl9zdGFydExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvY29kZWNzd2l0Y2ggOiAoYWFjICYmIGhlYWFjKVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbHM7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsKSB7XG4gICAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICAgIGlmKG5ld0xldmVsID49IDAgJiYgbmV3TGV2ZWwgPCB0aGlzLl9sZXZlbHMubGVuZ3RoKSB7XG4gICAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgICAgbG9nZ2VyLmxvZygnc3dpdGNoaW5nIHRvIGxldmVsICcgKyBuZXdMZXZlbCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfU1dJVENILCB7IGxldmVsSWQgOiBuZXdMZXZlbH0pO1xuICAgICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdO1xuICAgICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsXG4gICAgICAgIGlmKGxldmVsLmxvYWRpbmcgPT09IHVuZGVmaW5lZCB8fCAobGV2ZWwuZGV0YWlscyAmJiBsZXZlbC5kZXRhaWxzLmxpdmUgPT09IHRydWUpKSB7XG4gICAgICAgICAgLy8gbGV2ZWwgbm90IHJldHJpZXZlZCB5ZXQsIG9yIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byAocmUpbG9hZCBpdFxuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywgeyBsZXZlbElkIDogbmV3TGV2ZWx9KTtcbiAgICAgICAgICBsb2dnZXIubG9nKCcocmUpbG9hZGluZyBwbGF5bGlzdCBmb3IgbGV2ZWwgJyArIG5ld0xldmVsKTtcbiAgICAgICAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmxvYWQobGV2ZWwudXJsLG5ld0xldmVsKTtcbiAgICAgICAgICBsZXZlbC5sb2FkaW5nID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaW52YWxpZCBsZXZlbCBpZCBnaXZlbiwgdHJpZ2dlciBlcnJvclxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0VSUk9SLCB7IGxldmVsIDogbmV3TGV2ZWwsIGV2ZW50OiAnaW52YWxpZCBsZXZlbCBpZHgnfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgfVxuXG4gIHNldCBtYW51YWxMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5sZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgfVxuXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgaWYodGhpcy5fc3RhcnRMZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgc3RhdHMscnR0O1xuICAgIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICBydHQgPSBzdGF0cy50Zmlyc3QgLSBzdGF0cy50cmVxdWVzdDtcbiAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gKHN0YXRzLnRsb2FkIC0gc3RhdHMudHJlcXVlc3QpLzEwMDA7XG4gICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICB0aGlzLmxhc3RidyA9IHN0YXRzLmxlbmd0aCo4L3RoaXMubGFzdGZldGNoZHVyYXRpb247XG4gIH1cblxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgcGxheWxpc3QgaXMgYSBsaXZlIHBsYXlsaXN0XG4gICAgaWYoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwKmRhdGEuZGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgdGljaygpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHsgbGV2ZWxJZCA6IHRoaXMuX2xldmVsfSk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKHRoaXMuX2xldmVsc1t0aGlzLl9sZXZlbF0udXJsLHRoaXMuX2xldmVsKTtcbiAgfVxuXG4gIG5leHRMZXZlbCgpIHtcbiAgICBpZih0aGlzLl9tYW51YWxMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICByZXR1cm4gdGhpcy5uZXh0QXV0b0xldmVsKCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dEZldGNoRHVyYXRpb24oKSB7XG4gICAgaWYodGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMubGFzdGZldGNoZHVyYXRpb24qdGhpcy5fbGV2ZWxzW3RoaXMuX2xldmVsXS5iaXRyYXRlL3RoaXMuX2xldmVsc1t0aGlzLmxhc3RmZXRjaGxldmVsXS5iaXRyYXRlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gIH1cblxuICBuZXh0QXV0b0xldmVsKCkge1xuICAgIHZhciBsYXN0YncgPSB0aGlzLmxhc3RidyxhZGp1c3RlZGJ3LGksbWF4QXV0b0xldmVsO1xuICAgIGlmKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9sZXZlbHMubGVuZ3RoLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IoaSA9MDsgaSA8PSBtYXhBdXRvTGV2ZWwgOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmKGkgPD0gdGhpcy5fbGV2ZWwpIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuOCpsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43Kmxhc3RidztcbiAgICAgIH1cbiAgICAgIGlmKGFkanVzdGVkYncgPCB0aGlzLl9sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCxpLTEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaS0xO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcbiIsIiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyICAgICAgICAgICAgZnJvbSAnLi90c2RlbXV4ZXInO1xuIGltcG9ydCBUU0RlbXV4ZXJXb3JrZXIgICAgICBmcm9tICcuL3RzZGVtdXhlcndvcmtlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB2YXIgZW5hYmxlV29ya2VyID0gdHJ1ZTtcbiAgICBpZihlbmFibGVXb3JrZXIgJiYgKHR5cGVvZihXb3JrZXIpICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnVFMgZGVtdXhpbmcgaW4gd2Vid29ya2VyJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIHdvcmsgPSByZXF1aXJlKCd3ZWJ3b3JraWZ5Jyk7XG4gICAgICAgICAgdGhpcy53ID0gd29yayhUU0RlbXV4ZXJXb3JrZXIpO1xuICAgICAgICAgIHRoaXMub253bXNnID0gdGhpcy5vbldvcmtlck1lc3NhZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgICB0aGlzLncuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgICAgICB0aGlzLncucG9zdE1lc3NhZ2UoeyBjbWQgOiAnaW5pdCd9KTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdlcnJvciB3aGlsZSBpbml0aWFsaXppbmcgVFNEZW11eGVyV29ya2VyLCBmYWxsYmFjayBvbiByZWd1bGFyIFRTRGVtdXhlcicpO1xuICAgICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IFRTRGVtdXhlcigpO1xuICAgICAgfVxuICAgICAgdGhpcy5kZW11eEluaXRpYWxpemVkID0gdHJ1ZTtcbiAgfVxuXG4gIHNldER1cmF0aW9uKG5ld0R1cmF0aW9uKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2UoeyBjbWQgOiAnZHVyYXRpb24nICwgZGF0YSA6IG5ld0R1cmF0aW9ufSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5zZXREdXJhdGlvbihuZXdEdXJhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLncpIHtcbiAgICAgIHRoaXMudy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJyx0aGlzLm9ud21zZyk7XG4gICAgICB0aGlzLncudGVybWluYXRlKCk7XG4gICAgICB0aGlzLncgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCkge1xuICAgIGlmKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ2RlbXV4JyAsIGRhdGEgOiBkYXRhLCBhdWRpb0NvZGVjIDogYXVkaW9Db2RlYywgdmlkZW9Db2RlYzogdmlkZW9Db2RlYywgdGltZU9mZnNldCA6IHRpbWVPZmZzZXR9LFtkYXRhXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEpLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0KTtcbiAgICAgIHRoaXMuZGVtdXhlci5lbmQoKTtcbiAgICB9XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICBpZih0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdzd2l0Y2hMZXZlbCd9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLnN3aXRjaExldmVsKCk7XG4gICAgfVxuICB9XG5cbiAgb25Xb3JrZXJNZXNzYWdlKGV2KSB7XG4gICAgLy9jb25zb2xlLmxvZygnb25Xb3JrZXJNZXNzYWdlOicgKyBldi5kYXRhLmV2ZW50KTtcbiAgICBzd2l0Y2goZXYuZGF0YS5ldmVudCkge1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UOlxuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIGlmKGV2LmRhdGEuYXVkaW9Nb292KSB7XG4gICAgICAgICAgb2JqLmF1ZGlvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEuYXVkaW9Nb292KTtcbiAgICAgICAgICBvYmouYXVkaW9Db2RlYyA9IGV2LmRhdGEuYXVkaW9Db2RlYztcbiAgICAgICAgICBvYmouYXVkaW9DaGFubmVsQ291bnQgPSBldi5kYXRhLmF1ZGlvQ2hhbm5lbENvdW50O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZXYuZGF0YS52aWRlb01vb3YpIHtcbiAgICAgICAgICBvYmoudmlkZW9Nb292ID0gbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS52aWRlb01vb3YpO1xuICAgICAgICAgIG9iai52aWRlb0NvZGVjID0gZXYuZGF0YS52aWRlb0NvZGVjO1xuICAgICAgICAgIG9iai52aWRlb1dpZHRoID0gZXYuZGF0YS52aWRlb1dpZHRoO1xuICAgICAgICAgIG9iai52aWRlb0hlaWdodCA9IGV2LmRhdGEudmlkZW9IZWlnaHQ7XG4gICAgICAgIH1cbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBvYmopO1xuICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBOlxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgICAgICBtb29mIDogbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5tb29mKSxcbiAgICAgICAgICBtZGF0IDogbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5tZGF0KSxcbiAgICAgICAgICBzdGFydFBUUyA6IGV2LmRhdGEuc3RhcnRQVFMsXG4gICAgICAgICAgZW5kUFRTIDogZXYuZGF0YS5lbmRQVFMsXG4gICAgICAgICAgc3RhcnREVFMgOiBldi5kYXRhLnN0YXJ0RFRTLFxuICAgICAgICAgIGVuZERUUyA6IGV2LmRhdGEuZW5kRFRTLFxuICAgICAgICAgIHR5cGUgOiBldi5kYXRhLnR5cGVcbiAgICAgICAgfSk7XG4gICAgICBicmVhaztcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTRUQ6XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBEZW11eGVyO1xuIiwiLyoqXG4gKiBQYXJzZXIgZm9yIGV4cG9uZW50aWFsIEdvbG9tYiBjb2RlcywgYSB2YXJpYWJsZS1iaXR3aWR0aCBudW1iZXIgZW5jb2RpbmdcbiAqIHNjaGVtZSB1c2VkIGJ5IGgyNjQuXG4gKi9cblxuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBFeHBHb2xvbWIge1xuXG4gIGNvbnN0cnVjdG9yKHdvcmtpbmdEYXRhKSB7XG4gICAgdGhpcy53b3JraW5nRGF0YSA9IHdvcmtpbmdEYXRhO1xuICAgIC8vIHRoZSBudW1iZXIgb2YgYnl0ZXMgbGVmdCB0byBleGFtaW5lIGluIHRoaXMud29ya2luZ0RhdGFcbiAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSA9IHRoaXMud29ya2luZ0RhdGEuYnl0ZUxlbmd0aDtcbiAgICAvLyB0aGUgY3VycmVudCB3b3JkIGJlaW5nIGV4YW1pbmVkXG4gICAgdGhpcy53b3JraW5nV29yZCA9IDA7IC8vIDp1aW50XG4gICAgLy8gdGhlIG51bWJlciBvZiBiaXRzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGUgY3VycmVudCB3b3JkXG4gICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLndvcmtpbmdEYXRhLmJ5dGVMZW5ndGggLSB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSxcbiAgICAgIHdvcmtpbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KDQpLFxuICAgICAgYXZhaWxhYmxlQnl0ZXMgPSBNYXRoLm1pbig0LCB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSk7XG5cbiAgICBpZiAoYXZhaWxhYmxlQnl0ZXMgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbm8gYnl0ZXMgYXZhaWxhYmxlJyk7XG4gICAgfVxuXG4gICAgd29ya2luZ0J5dGVzLnNldCh0aGlzLndvcmtpbmdEYXRhLnN1YmFycmF5KHBvc2l0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29ya2luZ1dvcmQgPSBuZXcgRGF0YVZpZXcod29ya2luZ0J5dGVzLmJ1ZmZlcikuZ2V0VWludDMyKDApO1xuXG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLndvcmtpbmdEYXRhIHRoYXQgaGFzIGJlZW4gcHJvY2Vzc2VkXG4gICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA9IGF2YWlsYWJsZUJ5dGVzICogODtcbiAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPiBjb3VudCkge1xuICAgICAgdGhpcy53b3JraW5nV29yZCAgICAgICAgICA8PD0gY291bnQ7XG4gICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlO1xuICAgICAgc2tpcEJ5dGVzID0gY291bnQgPj4gMztcblxuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMud29ya2luZ0J5dGVzQXZhaWxhYmxlIC09IHNraXBCeXRlcztcblxuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuXG4gICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfVxuICB9XG5cbiAgLy8gKHNpemU6aW50KTp1aW50XG4gIHJlYWRCaXRzKHNpemUpIHtcbiAgICB2YXJcbiAgICAgIGJpdHMgPSBNYXRoLm1pbih0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlLCBzaXplKSwgLy8gOnVpbnRcbiAgICAgIHZhbHUgPSB0aGlzLndvcmtpbmdXb3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcblxuICAgIGlmKHNpemUgPjMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cblxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMud29ya2luZ1dvcmQgPDw9IGJpdHM7XG4gICAgfSBlbHNlIGlmICh0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG5cbiAgICBiaXRzID0gc2l6ZSAtIGJpdHM7XG4gICAgaWYgKGJpdHMgPiAwKSB7XG4gICAgICByZXR1cm4gdmFsdSA8PCBiaXRzIHwgdGhpcy5yZWFkQml0cyhiaXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbHU7XG4gICAgfVxuICB9XG5cbiAgLy8gKCk6dWludFxuICBza2lwTGVhZGluZ1plcm9zKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDAgOyBsZWFkaW5nWmVyb0NvdW50IDwgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmtpbmdXb3JkICYgKDB4ODAwMDAwMDAgPj4+IGxlYWRpbmdaZXJvQ291bnQpKSkge1xuICAgICAgICAvLyB0aGUgZmlyc3QgYml0IG9mIHdvcmtpbmcgd29yZCBpcyAxXG4gICAgICAgIHRoaXMud29ya2luZ1dvcmQgPDw9IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gd2UgZXhoYXVzdGVkIHdvcmtpbmdXb3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcFVuc2lnbmVkRXhwR29sb21iKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExlYWRpbmdaZXJvcygpKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcEV4cEdvbG9tYigpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVbnNpZ25lZEV4cEdvbG9tYigpIHtcbiAgICB2YXIgY2x6ID0gdGhpcy5za2lwTGVhZGluZ1plcm9zKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFeHBHb2xvbWIoKSB7XG4gICAgdmFyIHZhbHUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVuc2lnbmVkQnl0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyg4KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBFeHBHb2xvbWIgZGVjb2RlciBwYXN0IGEgc2NhbGluZyBsaXN0LiBUaGUgc2NhbGluZ1xuICAgKiBsaXN0IGlzIG9wdGlvbmFsbHkgdHJhbnNtaXR0ZWQgYXMgcGFydCBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlclxuICAgKiBzZXQgYW5kIGlzIG5vdCByZWxldmFudCB0byB0cmFuc211eGluZy5cbiAgICogQHBhcmFtIGNvdW50IHtudW1iZXJ9IHRoZSBudW1iZXIgb2YgZW50cmllcyBpbiB0aGlzIHNjYWxpbmcgbGlzdFxuICAgKiBAc2VlIFJlY29tbWVuZGF0aW9uIElUVS1UIEguMjY0LCBTZWN0aW9uIDcuMy4yLjEuMS4xXG4gICAqL1xuICBza2lwU2NhbGluZ0xpc3QoY291bnQpIHtcbiAgICB2YXJcbiAgICAgIGxhc3RTY2FsZSA9IDgsXG4gICAgICBuZXh0U2NhbGUgPSA4LFxuICAgICAgaixcbiAgICAgIGRlbHRhU2NhbGU7XG5cbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRXhwR29sb21iKCk7XG4gICAgICAgIG5leHRTY2FsZSA9IChsYXN0U2NhbGUgKyBkZWx0YVNjYWxlICsgMjU2KSAlIDI1NjtcbiAgICAgIH1cblxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU2VxdWVuY2VQYXJhbWV0ZXJTZXQoKSB7XG4gICAgdmFyXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSAwLFxuICAgICAgcHJvZmlsZUlkYyxwcm9maWxlQ29tcGF0aWJpbGl0eSxsZXZlbElkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG5cbiAgICB0aGlzLnJlYWRVbnNpZ25lZEJ5dGUoKTtcbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7IC8vIHByb2ZpbGVfaWRjXG4gICAgcHJvZmlsZUNvbXBhdGliaWxpdHkgPSB0aGlzLnJlYWRCaXRzKDUpOyAvLyBjb25zdHJhaW50X3NldFswLTRdX2ZsYWcsIHUoNSlcbiAgICB0aGlzLnNraXBCaXRzKDMpOyAvLyByZXNlcnZlZF96ZXJvXzNiaXRzIHUoMyksXG4gICAgbGV2ZWxJZGMgPSB0aGlzLnJlYWRVbnNpZ25lZEJ5dGUoKTsgLy9sZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIHNlcV9wYXJhbWV0ZXJfc2V0X2lkXG5cbiAgICAvLyBzb21lIHByb2ZpbGVzIGhhdmUgbW9yZSBvcHRpb25hbCBkYXRhIHdlIGRvbid0IG5lZWRcbiAgICBpZiAocHJvZmlsZUlkYyA9PT0gMTAwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjIgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTQ0KSB7XG4gICAgICB2YXIgY2hyb21hRm9ybWF0SWRjID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGlmIChjaHJvbWFGb3JtYXRJZGMgPT09IDMpIHtcbiAgICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gc2VwYXJhdGVfY29sb3VyX3BsYW5lX2ZsYWdcbiAgICAgIH1cbiAgICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIGJpdF9kZXB0aF9sdW1hX21pbnVzOFxuICAgICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gYml0X2RlcHRoX2Nocm9tYV9taW51czhcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHFwcHJpbWVfeV96ZXJvX3RyYW5zZm9ybV9ieXBhc3NfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19tYXRyaXhfcHJlc2VudF9mbGFnXG4gICAgICAgIHNjYWxpbmdMaXN0Q291bnQgPSAoY2hyb21hRm9ybWF0SWRjICE9PSAzKSA/IDggOiAxMjtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNjYWxpbmdMaXN0Q291bnQ7IGkrKykge1xuICAgICAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbGlzdF9wcmVzZW50X2ZsYWdbIGkgXVxuICAgICAgICAgICAgaWYgKGkgPCA2KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDE2KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBsb2cyX21heF9mcmFtZV9udW1fbWludXM0XG4gICAgdmFyIHBpY09yZGVyQ250VHlwZSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG5cbiAgICBpZiAocGljT3JkZXJDbnRUeXBlID09PSAwKSB7XG4gICAgICB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpOyAvL2xvZzJfbWF4X3BpY19vcmRlcl9jbnRfbHNiX21pbnVzNFxuICAgIH0gZWxzZSBpZiAocGljT3JkZXJDbnRUeXBlID09PSAxKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkZWx0YV9waWNfb3JkZXJfYWx3YXlzX3plcm9fZmxhZ1xuICAgICAgdGhpcy5za2lwRXhwR29sb21iKCk7IC8vIG9mZnNldF9mb3Jfbm9uX3JlZl9waWNcbiAgICAgIHRoaXMuc2tpcEV4cEdvbG9tYigpOyAvLyBvZmZzZXRfZm9yX3RvcF90b19ib3R0b21fZmllbGRcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGU7IGkrKykge1xuICAgICAgICB0aGlzLnNraXBFeHBHb2xvbWIoKTsgLy8gb2Zmc2V0X2Zvcl9yZWZfZnJhbWVbIGkgXVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIG1heF9udW1fcmVmX2ZyYW1lc1xuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGdhcHNfaW5fZnJhbWVfbnVtX3ZhbHVlX2FsbG93ZWRfZmxhZ1xuXG4gICAgcGljV2lkdGhJbk1ic01pbnVzMSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG5cbiAgICBmcmFtZU1ic09ubHlGbGFnID0gdGhpcy5yZWFkQml0cygxKTtcbiAgICBpZiAoZnJhbWVNYnNPbmx5RmxhZyA9PT0gMCkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gbWJfYWRhcHRpdmVfZnJhbWVfZmllbGRfZmxhZ1xuICAgIH1cblxuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRpcmVjdF84eDhfaW5mZXJlbmNlX2ZsYWdcbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIGZyYW1lX2Nyb3BwaW5nX2ZsYWdcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHByb2ZpbGVJZGMgOiBwcm9maWxlSWRjLFxuICAgICAgcHJvZmlsZUNvbXBhdGliaWxpdHkgOiBwcm9maWxlQ29tcGF0aWJpbGl0eSxcbiAgICAgIGxldmVsSWRjIDogbGV2ZWxJZGMsXG4gICAgICB3aWR0aDogKChwaWNXaWR0aEluTWJzTWludXMxICsgMSkgKiAxNikgLSBmcmFtZUNyb3BMZWZ0T2Zmc2V0ICogMiAtIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ICogMixcbiAgICAgIGhlaWdodDogKCgyIC0gZnJhbWVNYnNPbmx5RmxhZykgKiAocGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSArIDEpICogMTYpIC0gKGZyYW1lQ3JvcFRvcE9mZnNldCAqIDIpIC0gKGZyYW1lQ3JvcEJvdHRvbU9mZnNldCAqIDIpXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIEEgc3RyZWFtLWJhc2VkIG1wMnRzIHRvIG1wNCBjb252ZXJ0ZXIuIFRoaXMgdXRpbGl0eSBpcyB1c2VkIHRvXG4gKiBkZWxpdmVyIG1wNHMgdG8gYSBTb3VyY2VCdWZmZXIgb24gcGxhdGZvcm1zIHRoYXQgc3VwcG9ydCBuYXRpdmVcbiAqIE1lZGlhIFNvdXJjZSBFeHRlbnNpb25zLlxuICovXG5cbiBpbXBvcnQgRXZlbnQgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV4cEdvbG9tYiAgICAgICBmcm9tICcuL2V4cC1nb2xvbWInO1xuLy8gaW1wb3J0IEhleCAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9oZXgnO1xuIGltcG9ydCBNUDQgICAgICAgICAgICAgZnJvbSAnLi4vcmVtdXgvbXA0LWdlbmVyYXRvcic7XG4vLyBpbXBvcnQgTVA0SW5zcGVjdCAgICAgIGZyb20gJy4uL3JlbXV4L21wNC1pbnNwZWN0b3InO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFRTRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICB9XG5cbiAgc2V0RHVyYXRpb24obmV3RHVyYXRpb24pIHtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IG5ld0R1cmF0aW9uO1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5wbXRQYXJzZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9wbXRJZCA9IHRoaXMuX2F2Y0lkID0gdGhpcy5fYWFjSWQgPSAtMTtcbiAgICB0aGlzLl9hdmNUcmFjayA9IHt0eXBlIDogJ3ZpZGVvJywgc2VxdWVuY2VOdW1iZXIgOiAwfTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHt0eXBlIDogJ2F1ZGlvJywgc2VxdWVuY2VOdW1iZXIgOiAwfTtcbiAgICB0aGlzLl9hdmNTYW1wbGVzID0gW107XG4gICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSA9IDA7XG4gICAgdGhpcy5fYWFjU2FtcGxlcyA9IFtdO1xuICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsdGltZU9mZnNldCkge1xuICAgIHRoaXMuYXVkaW9Db2RlYyA9IGF1ZGlvQ29kZWM7XG4gICAgdGhpcy52aWRlb0NvZGVjID0gdmlkZW9Db2RlYztcbiAgICB0aGlzLnRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICAgIHZhciBvZmZzZXQ7XG4gICAgZm9yKG9mZnNldCA9IDA7IG9mZnNldCA8IGRhdGEubGVuZ3RoIDsgb2Zmc2V0ICs9IDE4OCkge1xuICAgICAgdGhpcy5fcGFyc2VUU1BhY2tldChkYXRhLG9mZnNldCk7XG4gICAgfVxuICB9XG4gIC8vIGZsdXNoIGFueSBidWZmZXJlZCBkYXRhXG4gIGVuZCgpIHtcbiAgICBpZih0aGlzLl9hdmNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyh0aGlzLl9hdmNEYXRhKSk7XG4gICAgICB0aGlzLl9hdmNEYXRhID0gbnVsbDtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBBVkMgc2FtcGxlczonICsgdGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLl9mbHVzaEFWQ1NhbXBsZXMoKTtcbiAgICB9XG4gICAgaWYodGhpcy5fYWFjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVModGhpcy5fYWFjRGF0YSkpO1xuICAgICAgdGhpcy5fYWFjRGF0YSA9IG51bGw7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQUFDIHNhbXBsZXM6JyArIHRoaXMuX2FhY1NhbXBsZXMubGVuZ3RoKTtcbiAgICBpZih0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBQUNTYW1wbGVzKCk7XG4gICAgfVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNFRCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuX2R1cmF0aW9uID0gMDtcbiAgfVxuXG4gIF9wYXJzZVRTUGFja2V0KGRhdGEsc3RhcnQpIHtcbiAgICB2YXIgc3R0LHBpZCxhdGYsb2Zmc2V0O1xuICAgIGlmKGRhdGFbc3RhcnRdID09PSAweDQ3KSB7XG4gICAgICBzdHQgPSAhIShkYXRhW3N0YXJ0KzFdICYgMHg0MCk7XG4gICAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIFRTWzFdXG4gICAgICBwaWQgPSAoKGRhdGFbc3RhcnQrMV0gJiAweDFmKSA8PCA4KSArIGRhdGFbc3RhcnQrMl07XG4gICAgICBhdGYgPSAoZGF0YVtzdGFydCszXSAmIDB4MzApID4+IDQ7XG4gICAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGUgZmlmdGggYnl0ZSBvZiB0aGUgVFMgcGFja2V0IGhlYWRlci5cbiAgICAgIGlmKGF0ZiA+IDEpIHtcbiAgICAgICAgb2Zmc2V0ID0gc3RhcnQrNStkYXRhW3N0YXJ0KzRdO1xuICAgICAgICAvLyByZXR1cm4gaWYgdGhlcmUgaXMgb25seSBhZGFwdGF0aW9uIGZpZWxkXG4gICAgICAgIGlmKG9mZnNldCA9PT0gKHN0YXJ0KzE4OCkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9mZnNldCA9IHN0YXJ0KzQ7XG4gICAgICB9XG4gICAgICBpZih0aGlzLnBtdFBhcnNlZCkge1xuICAgICAgICBpZihwaWQgPT09IHRoaXMuX2F2Y0lkKSB7XG4gICAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgICBpZih0aGlzLl9hdmNEYXRhKSB7XG4gICAgICAgICAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKHRoaXMuX2F2Y0RhdGEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2F2Y0RhdGEgPSB7ZGF0YTogW10sc2l6ZTogMH07XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2F2Y0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LHN0YXJ0KzE4OCkpO1xuICAgICAgICAgIHRoaXMuX2F2Y0RhdGEuc2l6ZSs9c3RhcnQrMTg4LW9mZnNldDtcbiAgICAgICAgfSBlbHNlIGlmKHBpZCA9PT0gdGhpcy5fYWFjSWQpIHtcbiAgICAgICAgICBpZihzdHQpIHtcbiAgICAgICAgICAgIGlmKHRoaXMuX2FhY0RhdGEpIHtcbiAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVModGhpcy5fYWFjRGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fYWFjRGF0YSA9IHtkYXRhOiBbXSxzaXplOiAwfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fYWFjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsc3RhcnQrMTg4KSk7XG4gICAgICAgICAgdGhpcy5fYWFjRGF0YS5zaXplKz1zdGFydCsxODgtb2Zmc2V0O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZihzdHQpIHtcbiAgICAgICAgICBvZmZzZXQgKz0gZGF0YVtvZmZzZXRdICsgMTtcbiAgICAgICAgfVxuICAgICAgICBpZihwaWQgPT09IDApIHtcbiAgICAgICAgICB0aGlzLl9wYXJzZVBBVChkYXRhLG9mZnNldCk7XG4gICAgICAgIH0gZWxzZSBpZihwaWQgPT09IHRoaXMuX3BtdElkKSB7XG4gICAgICAgICAgdGhpcy5fcGFyc2VQTVQoZGF0YSxvZmZzZXQpO1xuICAgICAgICAgIHRoaXMucG10UGFyc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIubG9nKCdwYXJzaW5nIGVycm9yJyk7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEFUKGRhdGEsb2Zmc2V0KSB7XG4gICAgLy8gc2tpcCB0aGUgUFNJIGhlYWRlciBhbmQgcGFyc2UgdGhlIGZpcnN0IFBNVCBlbnRyeVxuICAgIHRoaXMuX3BtdElkICA9IChkYXRhW29mZnNldCsxMF0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQrMTFdO1xuICAgIC8vbG9nZ2VyLmxvZygnUE1UIFBJRDonICArIHRoaXMuX3BtdElkKTtcbiAgfVxuXG4gIF9wYXJzZVBNVChkYXRhLG9mZnNldCkge1xuICAgIHZhciBzZWN0aW9uTGVuZ3RoLHRhYmxlRW5kLHByb2dyYW1JbmZvTGVuZ3RoLHBpZDtcbiAgICBzZWN0aW9uTGVuZ3RoID0gKGRhdGFbb2Zmc2V0KzFdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0KzJdO1xuICAgIHRhYmxlRW5kID0gb2Zmc2V0ICsgMyArIHNlY3Rpb25MZW5ndGggLSA0O1xuICAgIC8vIHRvIGRldGVybWluZSB3aGVyZSB0aGUgdGFibGUgaXMsIHdlIGhhdmUgdG8gZmlndXJlIG91dCBob3dcbiAgICAvLyBsb25nIHRoZSBwcm9ncmFtIGluZm8gZGVzY3JpcHRvcnMgYXJlXG4gICAgcHJvZ3JhbUluZm9MZW5ndGggPSAoZGF0YVtvZmZzZXQrMTBdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0KzExXTtcblxuICAgIC8vIGFkdmFuY2UgdGhlIG9mZnNldCB0byB0aGUgZmlyc3QgZW50cnkgaW4gdGhlIG1hcHBpbmcgdGFibGVcbiAgICBvZmZzZXQgKz0gMTIgKyBwcm9ncmFtSW5mb0xlbmd0aDtcbiAgICB3aGlsZSAob2Zmc2V0IDwgdGFibGVFbmQpIHtcbiAgICAgIHBpZCA9IChkYXRhW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgICBzd2l0Y2goZGF0YVtvZmZzZXRdKSB7XG4gICAgICAgIC8vIElTTy9JRUMgMTM4MTgtNyBBRFRTIEFBQyAoTVBFRy0yIGxvd2VyIGJpdC1yYXRlIGF1ZGlvKVxuICAgICAgICBjYXNlIDB4MGY6XG4gICAgICAgIC8vbG9nZ2VyLmxvZygnQUFDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYWFjSWQgPSBwaWQ7XG4gICAgICAgICAgdGhpcy5fYWFjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBJVFUtVCBSZWMuIEguMjY0IGFuZCBJU08vSUVDIDE0NDk2LTEwIChsb3dlciBiaXQtcmF0ZSB2aWRlbylcbiAgICAgICAgY2FzZSAweDFiOlxuICAgICAgICAvL2xvZ2dlci5sb2coJ0FWQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICB0aGlzLl9hdmNJZCA9IHBpZDtcbiAgICAgICAgdGhpcy5fYXZjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICBsb2dnZXIubG9nKCd1bmtvd24gc3RyZWFtIHR5cGU6JyAgKyBkYXRhW29mZnNldF0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIG1vdmUgdG8gdGhlIG5leHQgdGFibGUgZW50cnlcbiAgICAgIC8vIHNraXAgcGFzdCB0aGUgZWxlbWVudGFyeSBzdHJlYW0gZGVzY3JpcHRvcnMsIGlmIHByZXNlbnRcbiAgICAgIG9mZnNldCArPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDBGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyA0XSkgKyA1O1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBFUyhzdHJlYW0pIHtcbiAgICB2YXIgaSA9IDAsZnJhZyxwZXNGbGFncyxwZXNQcmVmaXgscGVzTGVuLHBlc0hkckxlbixwZXNEYXRhLHBlc1B0cyxwZXNEdHMscGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgIC8vcmV0cmlldmUgUFRTL0RUUyBmcm9tIGZpcnN0IGZyYWdtZW50XG4gICAgZnJhZyA9IHN0cmVhbS5kYXRhWzBdO1xuICAgIHBlc1ByZWZpeCA9IChmcmFnWzBdIDw8IDE2KSArIChmcmFnWzFdIDw8IDgpICsgZnJhZ1syXTtcbiAgICBpZihwZXNQcmVmaXggPT09IDEpIHtcbiAgICAgIHBlc0xlbiA9IChmcmFnWzRdIDw8IDgpICsgZnJhZ1s1XTtcbiAgICAgIHBlc0ZsYWdzID0gZnJhZ1s3XTtcbiAgICAgIGlmIChwZXNGbGFncyAmIDB4QzApIHtcbiAgICAgICAgLy8gUEVTIGhlYWRlciBkZXNjcmliZWQgaGVyZSA6IGh0dHA6Ly9kdmQuc291cmNlZm9yZ2UubmV0L2R2ZGluZm8vcGVzLWhkci5odG1sXG4gICAgICAgIHBlc1B0cyA9IChmcmFnWzldICYgMHgwRSkgPDwgMjlcbiAgICAgICAgICB8IChmcmFnWzEwXSAmIDB4RkYpIDw8IDIyXG4gICAgICAgICAgfCAoZnJhZ1sxMV0gJiAweEZFKSA8PCAxNFxuICAgICAgICAgIHwgKGZyYWdbMTJdICYgMHhGRikgPDwgIDdcbiAgICAgICAgICB8IChmcmFnWzEzXSAmIDB4RkUpID4+PiAgMTtcbiAgICAgICAgaWYgKHBlc0ZsYWdzICYgMHg0MCkge1xuICAgICAgICAgIHBlc0R0cyA9IChmcmFnWzE0XSAmIDB4MEUgKSA8PCAyOVxuICAgICAgICAgICAgfCAoZnJhZ1sxNV0gJiAweEZGICkgPDwgMjJcbiAgICAgICAgICAgIHwgKGZyYWdbMTZdICYgMHhGRSApIDw8IDE0XG4gICAgICAgICAgICB8IChmcmFnWzE3XSAmIDB4RkYgKSA8PCA3XG4gICAgICAgICAgICB8IChmcmFnWzE4XSAmIDB4RkUgKSA+Pj4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZXNEdHMgPSBwZXNQdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlc0hkckxlbiA9IGZyYWdbOF07XG4gICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSBwZXNIZHJMZW4rOTtcbiAgICAgIC8vIHRyaW0gUEVTIGhlYWRlclxuICAgICAgc3RyZWFtLmRhdGFbMF0gPSBzdHJlYW0uZGF0YVswXS5zdWJhcnJheShwYXlsb2FkU3RhcnRPZmZzZXQpO1xuICAgICAgc3RyZWFtLnNpemUgLT0gcGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgICAgLy9yZWFzc2VtYmxlIFBFUyBwYWNrZXRcbiAgICAgIHBlc0RhdGEgPSBuZXcgVWludDhBcnJheShzdHJlYW0uc2l6ZSk7XG4gICAgICAvLyByZWFzc2VtYmxlIHRoZSBwYWNrZXRcbiAgICAgIHdoaWxlIChzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgZnJhZyA9IHN0cmVhbS5kYXRhLnNoaWZ0KCk7XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpICs9IGZyYWcuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IGRhdGEgOiBwZXNEYXRhLCBwdHMgOiBwZXNQdHMsIGR0cyA6IHBlc0R0cywgbGVuIDogcGVzTGVufTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlQVZDUEVTKHBlcykge1xuICAgIHZhciB1bml0cyx0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLGF2Y1NhbXBsZSxrZXkgPSBmYWxzZTtcbiAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSk7XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdW5pdHMudW5pdHMuZm9yRWFjaCh1bml0ID0+IHtcbiAgICAgIHN3aXRjaCh1bml0LnR5cGUpIHtcbiAgICAgICAgLy9JRFJcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgIGtleSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU1BTXG4gICAgICAgIGNhc2UgNzpcbiAgICAgICAgICBpZighdHJhY2suc3BzKSB7XG4gICAgICAgICAgICB2YXIgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcbiAgICAgICAgICAgIHZhciBjb25maWcgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRTZXF1ZW5jZVBhcmFtZXRlclNldCgpO1xuICAgICAgICAgICAgdHJhY2sud2lkdGggPSBjb25maWcud2lkdGg7XG4gICAgICAgICAgICB0cmFjay5oZWlnaHQgPSBjb25maWcuaGVpZ2h0O1xuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUlkYyA9IGNvbmZpZy5wcm9maWxlSWRjO1xuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUNvbXBhdGliaWxpdHkgPSBjb25maWcucHJvZmlsZUNvbXBhdGliaWxpdHk7XG4gICAgICAgICAgICB0cmFjay5sZXZlbElkYyA9IGNvbmZpZy5sZXZlbElkYztcbiAgICAgICAgICAgIHRyYWNrLnNwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgICAgdHJhY2suZHVyYXRpb24gPSA5MDAwMCp0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgICAgIHZhciBjb2RlY2FycmF5ID0gdW5pdC5kYXRhLnN1YmFycmF5KDEsNCk7XG4gICAgICAgICAgICB2YXIgY29kZWNzdHJpbmcgID0gJ2F2YzEuJztcbiAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICAgIGlmIChoLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGVjc3RyaW5nICs9IGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFjay5jb2RlYyA9IGNvZGVjc3RyaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9QUFNcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgIGlmKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvL2J1aWxkIHNhbXBsZSBmcm9tIFBFU1xuICAgIC8vIEFubmV4IEIgdG8gTVA0IGNvbnZlcnNpb24gdG8gYmUgZG9uZVxuICAgIGF2Y1NhbXBsZSA9IHsgdW5pdHMgOiB1bml0cywgcHRzIDogcGVzLnB0cywgZHRzIDogcGVzLmR0cyAsIGtleSA6IGtleX07XG4gICAgdGhpcy5fYXZjU2FtcGxlcy5wdXNoKGF2Y1NhbXBsZSk7XG4gICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCArPSB1bml0cy5sZW5ndGg7XG4gICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSArPSB1bml0cy51bml0cy5sZW5ndGg7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmKCF0aGlzLl9pbml0U2VnR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLl9nZW5lcmF0ZUluaXRTZWdtZW50KCk7XG4gICAgfVxuICB9XG5cblxuICBfZmx1c2hBVkNTYW1wbGVzKCkge1xuICAgIHZhciB2aWV3LGk9OCxhdmNTYW1wbGUsbXA0U2FtcGxlLG1wNFNhbXBsZUxlbmd0aCx1bml0LHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgIGxhc3RTYW1wbGVEVFMsbWRhdCxtb29mLGZpcnN0UFRTLGZpcnN0RFRTO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYXZjU2FtcGxlc0xlbmd0aCArICg0ICogdGhpcy5fYXZjU2FtcGxlc05iTmFsdSkrOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCxtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LDQpO1xuICAgIHdoaWxlKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzLnNoaWZ0KCk7XG4gICAgICBtcDRTYW1wbGVMZW5ndGggPSAwO1xuXG4gICAgICAvLyBjb252ZXJ0IE5BTFUgYml0c3RyZWFtIHRvIE1QNCBmb3JtYXQgKHByZXBlbmQgTkFMVSB3aXRoIHNpemUgZmllbGQpXG4gICAgICB3aGlsZShhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIHVuaXQgPSBhdmNTYW1wbGUudW5pdHMudW5pdHMuc2hpZnQoKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIoaSwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBpICs9IDQ7XG4gICAgICAgIG1kYXQuc2V0KHVuaXQuZGF0YSwgaSk7XG4gICAgICAgIGkgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCs9NCt1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgYXZjU2FtcGxlLnB0cyAtPSB0aGlzLl9pbml0RFRTO1xuICAgICAgYXZjU2FtcGxlLmR0cyAtPSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKCdWaWRlby9QVFMvRFRTOicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyk7XG5cbiAgICAgIGlmKGxhc3RTYW1wbGVEVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBhdmNTYW1wbGUuZHRzIC0gbGFzdFNhbXBsZURUUztcbiAgICAgICAgaWYobXA0U2FtcGxlLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnaW52YWxpZCBzYW1wbGUgZHVyYXRpb24gYXQgUFRTL0RUUzo6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzICsgJzonICsgbXA0U2FtcGxlLmR1cmF0aW9uKTtcbiAgICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjaGVjayBpZiBmcmFnbWVudHMgYXJlIGNvbnRpZ3VvdXMgKGkuZS4gbm8gbWlzc2luZyBmcmFtZXMgYmV0d2VlbiBmcmFnbWVudClcbiAgICAgICAgaWYodGhpcy5uZXh0QXZjUHRzKSB7XG4gICAgICAgICAgdmFyIGRlbHRhID0gKGF2Y1NhbXBsZS5wdHMgLSB0aGlzLm5leHRBdmNQdHMpLzkwLGFic2RlbHRhPU1hdGguYWJzKGRlbHRhKTtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fic2RlbHRhL2F2Y1NhbXBsZS5wdHM6JyArIGFic2RlbHRhICsgJy8nICsgYXZjU2FtcGxlLnB0cyk7XG4gICAgICAgICAgLy8gaWYgZGVsdGEgaXMgbGVzcyB0aGFuIDMwMCBtcywgbmV4dCBsb2FkZWQgZnJhZ21lbnQgaXMgYXNzdW1lZCB0byBiZSBjb250aWd1b3VzIHdpdGggbGFzdCBvbmVcbiAgICAgICAgICBpZihhYnNkZWx0YSA8IDMwMCkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdWaWRlbyBuZXh0IFBUUzonICsgdGhpcy5uZXh0QXZjUHRzKTtcbiAgICAgICAgICAgIGlmKGRlbHRhID4gMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKCdBVkM6JyArIGRlbHRhLnRvRml4ZWQoMCkgKyAnIG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdCcpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coJ0FWQzonICsgKC1kZWx0YS50b0ZpeGVkKDApKSArICcgbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBQVFMgdG8gbmV4dCBQVFNcbiAgICAgICAgICAgIGF2Y1NhbXBsZS5wdHMgPSB0aGlzLm5leHRBdmNQdHM7XG4gICAgICAgICAgICAvLyBvZmZzZXQgRFRTIGFzIHdlbGwsIGVuc3VyZSB0aGF0IERUUyBpcyBzbWFsbGVyIG9yIGVxdWFsIHRoYW4gbmV3IFBUU1xuICAgICAgICAgICAgYXZjU2FtcGxlLmR0cyA9IE1hdGgubWF4KGF2Y1NhbXBsZS5kdHMtZGVsdGEsIHRoaXMubGFzdEF2Y0R0cyk7XG4gICAgICAgICAgIC8vIGxvZ2dlci5sb2coJ1ZpZGVvL1BUUy9EVFMgYWRqdXN0ZWQ6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhdmNTYW1wbGVzXG4gICAgICAgIGZpcnN0UFRTID0gYXZjU2FtcGxlLnB0cztcbiAgICAgICAgZmlyc3REVFMgPSBhdmNTYW1wbGUuZHRzO1xuICAgICAgfVxuXG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgY29tcG9zaXRpb25UaW1lT2Zmc2V0OiBhdmNTYW1wbGUucHRzIC0gYXZjU2FtcGxlLmR0cyxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkYXRpb25Qcmlvcml0eTogMFxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBpZihhdmNTYW1wbGUua2V5ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHRoZSBjdXJyZW50IHNhbXBsZSBpcyBhIGtleSBmcmFtZVxuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuZGVwZW5kc09uID0gMjtcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmlzTm9uU3luY1NhbXBsZSA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuZGVwZW5kc09uID0gMTtcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmlzTm9uU3luY1NhbXBsZSA9IDE7XG4gICAgICB9XG4gICAgICB0cmFjay5zYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3RTYW1wbGVEVFMgPSBhdmNTYW1wbGUuZHRzO1xuICAgIH1cbiAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSB0cmFjay5zYW1wbGVzW3RyYWNrLnNhbXBsZXMubGVuZ3RoLTJdLmR1cmF0aW9uO1xuICAgIHRoaXMubGFzdEF2Y0R0cyA9IGF2Y1NhbXBsZS5kdHM7XG4gICAgLy8gbmV4dCBBVkMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBdmNQdHMgPSBhdmNTYW1wbGUucHRzICsgbXA0U2FtcGxlLmR1cmF0aW9uO1xuICAgIC8vbG9nZ2VyLmxvZygnVmlkZW8vbGFzdEF2Y0R0cy9uZXh0QXZjUHRzOicgKyB0aGlzLmxhc3RBdmNEdHMgKyAnLycgKyB0aGlzLm5leHRBdmNQdHMpO1xuXG4gICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCA9IDA7XG4gICAgdGhpcy5fYXZjU2FtcGxlc05iTmFsdSA9IDA7XG5cbiAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKyxmaXJzdERUUyx0cmFjayk7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICBtb29mOiBtb29mLFxuICAgICAgbWRhdDogbWRhdCxcbiAgICAgIHN0YXJ0UFRTIDogZmlyc3RQVFMvOTAwMDAsXG4gICAgICBlbmRQVFMgOiB0aGlzLm5leHRBdmNQdHMvOTAwMDAsXG4gICAgICBzdGFydERUUyA6IGZpcnN0RFRTLzkwMDAwLFxuICAgICAgZW5kRFRTIDogKGF2Y1NhbXBsZS5kdHMgKyBtcDRTYW1wbGUuZHVyYXRpb24pLzkwMDAwLFxuICAgICAgdHlwZSA6ICd2aWRlbydcbiAgICB9KTtcbiAgfVxuXG4gIF9wYXJzZUFWQ05BTHUoYXJyYXkpIHtcbiAgICB2YXIgaSA9IDAsbGVuID0gYXJyYXkuYnl0ZUxlbmd0aCx2YWx1ZSxvdmVyZmxvdyxzdGF0ZSA9IDA7XG4gICAgdmFyIHVuaXRzID0gW10sIHVuaXQsIHVuaXRUeXBlLCBsYXN0VW5pdFN0YXJ0LGxhc3RVbml0VHlwZSxsZW5ndGggPSAwO1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChhcnJheSkpO1xuXG4gICAgd2hpbGUoaTwgbGVuKSB7XG4gICAgICB2YWx1ZSA9IGFycmF5W2krK107XG4gICAgICAvLyBmaW5kaW5nIDMgb3IgNC1ieXRlIHN0YXJ0IGNvZGVzICgwMCAwMCAwMSBPUiAwMCAwMCAwMCAwMSlcbiAgICAgIHN3aXRjaChzdGF0ZSkge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAzO1xuICAgICAgICAgIH0gZWxzZSBpZih2YWx1ZSA9PT0gMSkge1xuICAgICAgICAgICAgdW5pdFR5cGUgPSBhcnJheVtpXSAmIDB4MWY7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgTkFMVSBAIG9mZnNldDonICsgaSArICcsdHlwZTonICsgdW5pdFR5cGUpO1xuICAgICAgICAgICAgaWYobGFzdFVuaXRTdGFydCkge1xuICAgICAgICAgICAgICB1bml0ID0geyBkYXRhIDogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCxpLXN0YXRlLTEpLCB0eXBlIDogbGFzdFVuaXRUeXBlfTtcbiAgICAgICAgICAgICAgbGVuZ3RoKz1pLXN0YXRlLTEtbGFzdFVuaXRTdGFydDtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgTkFMIHVuaXRzIGFyZSBub3Qgc3RhcnRpbmcgcmlnaHQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgUEVTIHBhY2tldCwgcHVzaCBwcmVjZWRpbmcgZGF0YSBpbnRvIHByZXZpb3VzIE5BTCB1bml0LlxuICAgICAgICAgICAgICBvdmVyZmxvdyAgPSBpIC0gc3RhdGUgLSAxO1xuICAgICAgICAgICAgICBpZiAob3ZlcmZsb3cpIHtcbiAgICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICBpZih0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHRoaXMuX2F2Y1NhbXBsZXNbdGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgtMV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgtMV07XG4gICAgICAgICAgICAgICAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgrb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsMCk7XG4gICAgICAgICAgICAgICAgICAgIHRtcC5zZXQoYXJyYXkuc3ViYXJyYXkoMCxvdmVyZmxvdyksbGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGgrPW92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoKz1vdmVyZmxvdztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIGlmKHVuaXRUeXBlID09PSAxIHx8IHVuaXRUeXBlID09PSA1KSB7XG4gICAgICAgICAgICAgIC8vIE9QVEkgISEhIGlmIElEUi9ORFIgdW5pdCwgY29uc2lkZXIgaXQgaXMgbGFzdCBOQUx1XG4gICAgICAgICAgICAgIGkgPSBsZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgIHVuaXQgPSB7IGRhdGEgOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LGxlbiksIHR5cGUgOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgbGVuZ3RoKz1sZW4tbGFzdFVuaXRTdGFydDtcbiAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiB7IHVuaXRzIDogdW5pdHMgLCBsZW5ndGggOiBsZW5ndGh9O1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLGFhY1NhbXBsZSxkYXRhID0gcGVzLmRhdGEsY29uZmlnLGFkdHNGcmFtZVNpemUsYWR0c1N0YXJ0T2Zmc2V0LGFkdHNIZWFkZXJMZW4sc3RhbXAsaTtcbiAgICBpZih0aGlzLmFhY092ZXJGbG93KSB7XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5hYWNPdmVyRmxvdy5ieXRlTGVuZ3RoK2RhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KHRoaXMuYWFjT3ZlckZsb3csMCk7XG4gICAgICB0bXAuc2V0KGRhdGEsdGhpcy5hYWNPdmVyRmxvdy5ieXRlTGVuZ3RoKTtcbiAgICAgIGRhdGEgPSB0bXA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChkYXRhKSk7XG4gICAgaWYoZGF0YVswXSA9PT0gMHhmZikge1xuICAgICAgaWYoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgICBjb25maWcgPSB0aGlzLl9BRFRTdG9BdWRpb0NvbmZpZyhwZXMuZGF0YSx0aGlzLmF1ZGlvQ29kZWMpO1xuICAgICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICAgIHRyYWNrLmR1cmF0aW9uID0gOTAwMDAqdGhpcy5fZHVyYXRpb247XG4gICAgICAgIGNvbnNvbGUubG9nKHRyYWNrLmNvZGVjICsnLHJhdGU6JyArIGNvbmZpZy5zYW1wbGVyYXRlICsgJyxuYiBjaGFubmVsOicgKyBjb25maWcuY2hhbm5lbENvdW50KTtcbiAgICAgIH1cbiAgICAgIGFkdHNTdGFydE9mZnNldCA9IGkgPSAwO1xuICAgICAgd2hpbGUoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCszXSAmIDB4MDMpIDw8IDExKTtcbiAgICAgICAgLy8gYnl0ZSA0XG4gICAgICAgIGFkdHNGcmFtZVNpemUgfD0gKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzRdIDw8IDMpO1xuICAgICAgICAvLyBieXRlIDVcbiAgICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgICBhZHRzSGVhZGVyTGVuID0gKCEhKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICAgIGFkdHNGcmFtZVNpemUgLT0gYWR0c0hlYWRlckxlbjtcbiAgICAgICAgc3RhbXAgPSBwZXMucHRzICsgaSoxMDI0KjkwMDAwL3RyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ0FBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC9wdHM6JyArIChhZHRzU3RhcnRPZmZzZXQrNykgKyAnLycgKyBhZHRzRnJhbWVTaXplICsgJy8nICsgc3RhbXAudG9GaXhlZCgwKSk7XG4gICAgICAgIGlmKGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuK2FkdHNGcmFtZVNpemUgPD0gZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICBhYWNTYW1wbGUgPSB7IHVuaXQgOiBkYXRhLnN1YmFycmF5KGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuLGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuK2FkdHNGcmFtZVNpemUpICwgcHRzIDogc3RhbXAsIGR0cyA6IHN0YW1wfTtcbiAgICAgICAgICB0aGlzLl9hYWNTYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoICs9IGFkdHNGcmFtZVNpemU7XG4gICAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0Kz1hZHRzRnJhbWVTaXplK2FkdHNIZWFkZXJMZW47XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0VSUk9SLCdTdHJlYW0gZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZighdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVJbml0U2VnbWVudCgpO1xuICAgIH1cbiAgICBpZihhZHRzU3RhcnRPZmZzZXQgPCBkYXRhLmxlbmd0aCkge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0LGRhdGEubGVuZ3RoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgX2ZsdXNoQUFDU2FtcGxlcygpIHtcbiAgICB2YXIgdmlldyxpPTgsYWFjU2FtcGxlLG1wNFNhbXBsZSx1bml0LHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGxhc3RTYW1wbGVEVFMsbWRhdCxtb29mLGZpcnN0UFRTLGZpcnN0RFRTO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYWFjU2FtcGxlc0xlbmd0aCs4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsNCk7XG4gICAgd2hpbGUodGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHRoaXMuX2FhY1NhbXBsZXMuc2hpZnQoKTtcbiAgICAgIHVuaXQgPSBhYWNTYW1wbGUudW5pdDtcbiAgICAgIG1kYXQuc2V0KHVuaXQsIGkpO1xuICAgICAgaSArPSB1bml0LmJ5dGVMZW5ndGg7XG5cbiAgICAgIGFhY1NhbXBsZS5wdHMgLT0gdGhpcy5faW5pdERUUztcbiAgICAgIGFhY1NhbXBsZS5kdHMgLT0gdGhpcy5faW5pdERUUztcblxuICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFM6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSk7XG4gICAgICBpZihsYXN0U2FtcGxlRFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gd2UgdXNlIERUUyB0byBjb21wdXRlIHNhbXBsZSBkdXJhdGlvbiwgYnV0IHdlIHVzZSBQVFMgdG8gY29tcHV0ZSBpbml0UFRTIHdoaWNoIGlzIHVzZWQgdG8gc3luYyBhdWRpbyBhbmQgdmlkZW9cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gYWFjU2FtcGxlLmR0cyAtIGxhc3RTYW1wbGVEVFM7XG4gICAgICAgIGlmKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gY2hlY2sgaWYgZnJhZ21lbnRzIGFyZSBjb250aWd1b3VzIChpLmUuIG5vIG1pc3NpbmcgZnJhbWVzIGJldHdlZW4gZnJhZ21lbnQpXG4gICAgICAgIGlmKHRoaXMubmV4dEFhY1B0cyAmJiB0aGlzLm5leHRBYWNQdHMgIT09IGFhY1NhbXBsZS5wdHMpIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvIG5leHQgUFRTOicgKyB0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICAgIHZhciBkZWx0YSA9IChhYWNTYW1wbGUucHRzIC0gdGhpcy5uZXh0QWFjUHRzKS85MDtcbiAgICAgICAgICAvLyBpZiBkZWx0YSBpcyBsZXNzIHRoYW4gMzAwIG1zLCBuZXh0IGxvYWRlZCBmcmFnbWVudCBpcyBhc3N1bWVkIHRvIGJlIGNvbnRpZ3VvdXMgd2l0aCBsYXN0IG9uZVxuICAgICAgICAgIGlmKE1hdGguYWJzKGRlbHRhKSA+IDEgJiYgTWF0aC5hYnMoZGVsdGEpIDwgMzAwKSB7XG4gICAgICAgICAgICBpZihkZWx0YSA+IDApIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnQUFDOicgKyBkZWx0YS50b0ZpeGVkKDApICsgJyBtcyBob2xlIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkLGZpbGxpbmcgaXQnKTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IFBUUywgYW5kIGVuc3VyZSBQVFMgaXMgZ3JlYXRlciBvciBlcXVhbCB0aGFuIGxhc3QgRFRTXG4gICAgICAgICAgICAgIGFhY1NhbXBsZS5wdHMgPSBNYXRoLm1heCh0aGlzLm5leHRBYWNQdHMsIHRoaXMubGFzdEFhY0R0cyk7XG4gICAgICAgICAgICAgIGFhY1NhbXBsZS5kdHMgPSBhYWNTYW1wbGUucHRzO1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9EVFMgYWRqdXN0ZWQ6JyArIGFhY1NhbXBsZS5wdHMgKyAnLycgKyBhYWNTYW1wbGUuZHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coJ0FBQzonICsgKC1kZWx0YS50b0ZpeGVkKDApKSArICcgbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhdmNTYW1wbGVzXG4gICAgICAgIGZpcnN0UFRTID0gYWFjU2FtcGxlLnB0cztcbiAgICAgICAgZmlyc3REVFMgPSBhYWNTYW1wbGUuZHRzO1xuICAgICAgfVxuXG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IHVuaXQuYnl0ZUxlbmd0aCxcbiAgICAgICAgY29tcG9zaXRpb25UaW1lT2Zmc2V0OiAwLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRhdGlvblByaW9yaXR5OiAwLFxuICAgICAgICAgIGRlcGVuZHNPbiA6IDEsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB0cmFjay5zYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3RTYW1wbGVEVFMgPSBhYWNTYW1wbGUuZHRzO1xuICAgIH1cbiAgICAvL3NldCBsYXN0IHNhbXBsZSBkdXJhdGlvbiBhcyBiZWluZyBpZGVudGljYWwgdG8gcHJldmlvdXMgc2FtcGxlXG4gICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gdHJhY2suc2FtcGxlc1t0cmFjay5zYW1wbGVzLmxlbmd0aC0yXS5kdXJhdGlvbjtcbiAgICB0aGlzLmxhc3RBYWNEdHMgPSBhYWNTYW1wbGUuZHRzO1xuICAgIC8vIG5leHQgYWFjIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QWFjUHRzID0gYWFjU2FtcGxlLnB0cyArIG1wNFNhbXBsZS5kdXJhdGlvbjtcbiAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9QVFNlbmQ6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSArICcvJyArIHRoaXMubmV4dEFhY0R0cy50b0ZpeGVkKDApKTtcblxuICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggPSAwO1xuXG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssZmlyc3REVFMsdHJhY2spO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUyA6IGZpcnN0UFRTLzkwMDAwLFxuICAgICAgZW5kUFRTIDogdGhpcy5uZXh0QWFjUHRzLzkwMDAwLFxuICAgICAgc3RhcnREVFMgOiBmaXJzdERUUy85MDAwMCxcbiAgICAgIGVuZERUUyA6IChhYWNTYW1wbGUuZHRzICsgbXA0U2FtcGxlLmR1cmF0aW9uKS85MDAwMCxcbiAgICAgIHR5cGUgOiAnYXVkaW8nXG4gICAgfSk7XG4gIH1cblxuICBfQURUU3RvQXVkaW9Db25maWcoZGF0YSxhdWRpb0NvZGVjKSB7XG4gICAgdmFyIGFkdHNPYmplY3RUeXBlLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBjb25maWcsXG4gICAgICAgIGFkdHNTYW1wbGVpbmdSYXRlcyA9IFtcbiAgICAgICAgICAgIDk2MDAwLCA4ODIwMCxcbiAgICAgICAgICAgIDY0MDAwLCA0ODAwMCxcbiAgICAgICAgICAgIDQ0MTAwLCAzMjAwMCxcbiAgICAgICAgICAgIDI0MDAwLCAyMjA1MCxcbiAgICAgICAgICAgIDE2MDAwLCAxMjAwMFxuICAgICAgICAgIF07XG5cbiAgICAvLyBieXRlIDJcbiAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVsyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgYWR0c1NhbXBsZWluZ0luZGV4ID0gKChkYXRhWzJdICYgMHgzQykgPj4+IDIpO1xuICAgIGFkdHNDaGFuZWxDb25maWcgPSAoKGRhdGFbMl0gJiAweDAxKSA8PCAyKTtcblxuICAgIC8vICBhbHdheXMgZm9yY2UgYXVkaW8gdHlwZSB0byBiZSBIRS1BQUMgU0JSLiBzb21lIGJyb3dzZXJzIGRvIG5vdCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaCBwcm9wZXJseVxuICAgIC8vIGluIGNhc2Ugc3RyZWFtIGlzIHJlYWxseSBIRS1BQUM6IGl0IHNob3VsZCBiZSBlaXRoZXIgIGFkdmVydGlzZWQgZGlyZWN0bHkgaW4gY29kZWNzIChyZXRyaWV2ZWQgZnJvbSBwYXJzaW5nIG1hbmlmZXN0KVxuICAgIC8vIG9yIGlmIG5vIGNvZGVjIHNwZWNpZmllZCx3ZSBpbXBsaWNpdGVseSBhc3N1bWUgdGhhdCBhdWRpbyB3aXRoIHNhbXBsaW5nIHJhdGUgbGVzcyBvciBlcXVhbCB0aGFuIDI0IGtIeiBpcyBIRS1BQUMgKGluZGV4IDYpXG4gICAgLy8gY3VycmVudGx5IGJyb2tlbiBvbiBDaHJvbWUvQW5kcm9pZFxuICAgIGlmKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhbmRyb2lkJykgPT09IC0xICYmXG4gICAgICAoKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkgfHwgKCFhdWRpb0NvZGVjICYmIGFkdHNTYW1wbGVpbmdJbmRleCA+PTYpKSkgIHtcbiAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZihuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYW5kcm9pZCcpID09PSAtMSAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpID09PSAtMSkge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgIH1lbHNlIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICB9XG4gICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgfVxuICAgIC8vIGJ5dGUgM1xuICAgIGFkdHNDaGFuZWxDb25maWcgfD0gKChkYXRhWzNdICYgMHhDMCkgPj4+IDYpO1xuICAvKiByZWZlciB0byBodHRwOi8vd2lraS5tdWx0aW1lZGlhLmN4L2luZGV4LnBocD90aXRsZT1NUEVHLTRfQXVkaW8jQXVkaW9fU3BlY2lmaWNfQ29uZmlnXG4gICAgICBJU08gMTQ0OTYtMyAoQUFDKS5wZGYgLSBUYWJsZSAxLjEzIOKAlCBTeW50YXggb2YgQXVkaW9TcGVjaWZpY0NvbmZpZygpXG4gICAgQXVkaW8gUHJvZmlsZSAvIEF1ZGlvIE9iamVjdCBUeXBlXG4gICAgMDogTnVsbFxuICAgIDE6IEFBQyBNYWluXG4gICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAzOiBBQUMgU1NSIChTY2FsYWJsZSBTYW1wbGUgUmF0ZSlcbiAgICA0OiBBQUMgTFRQIChMb25nIFRlcm0gUHJlZGljdGlvbilcbiAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgNjogQUFDIFNjYWxhYmxlXG4gICBzYW1wbGluZyBmcmVxXG4gICAgMDogOTYwMDAgSHpcbiAgICAxOiA4ODIwMCBIelxuICAgIDI6IDY0MDAwIEh6XG4gICAgMzogNDgwMDAgSHpcbiAgICA0OiA0NDEwMCBIelxuICAgIDU6IDMyMDAwIEh6XG4gICAgNjogMjQwMDAgSHpcbiAgICA3OiAyMjA1MCBIelxuICAgIDg6IDE2MDAwIEh6XG4gICAgOTogMTIwMDAgSHpcbiAgICAxMDogMTEwMjUgSHpcbiAgICAxMTogODAwMCBIelxuICAgIDEyOiA3MzUwIEh6XG4gICAgMTM6IFJlc2VydmVkXG4gICAgMTQ6IFJlc2VydmVkXG4gICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgIENoYW5uZWwgQ29uZmlndXJhdGlvbnNcbiAgICBUaGVzZSBhcmUgdGhlIGNoYW5uZWwgY29uZmlndXJhdGlvbnM6XG4gICAgMDogRGVmaW5lZCBpbiBBT1QgU3BlY2lmYyBDb25maWdcbiAgICAxOiAxIGNoYW5uZWw6IGZyb250LWNlbnRlclxuICAgIDI6IDIgY2hhbm5lbHM6IGZyb250LWxlZnQsIGZyb250LXJpZ2h0XG4gICovXG4gICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICBjb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuICAgIC8vIHNhbXBsaW5nRnJlcXVlbmN5SW5kZXhcbiAgICBjb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgY29uZmlnWzFdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcbiAgICBpZihhZHRzT2JqZWN0VHlwZSA9PT0gNSkge1xuICAgICAgLy8gYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4XG4gICAgICBjb25maWdbMV0gfD0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICBjb25maWdbMl0gPSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAgIC8vIGFkdHNPYmplY3RUeXBlIChmb3JjZSB0byAyLCBjaHJvbWUgaXMgY2hlY2tpbmcgdGhhdCBvYmplY3QgdHlwZSBpcyBsZXNzIHRoYW4gNSA/Pz9cbiAgICAgIC8vICAgIGh0dHBzOi8vY2hyb21pdW0uZ29vZ2xlc291cmNlLmNvbS9jaHJvbWl1bS9zcmMuZ2l0LysvbWFzdGVyL21lZGlhL2Zvcm1hdHMvbXA0L2FhYy5jY1xuICAgICAgY29uZmlnWzJdIHw9IDIgPDwgMjtcbiAgICAgIGNvbmZpZ1szXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiB7IGNvbmZpZyA6IGNvbmZpZywgc2FtcGxlcmF0ZSA6IGFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdLCBjaGFubmVsQ291bnQgOiBhZHRzQ2hhbmVsQ29uZmlnLCBjb2RlYyA6ICgnbXA0YS40MC4nICsgYWR0c09iamVjdFR5cGUpfTtcbiAgfVxuXG4gIF9nZW5lcmF0ZUluaXRTZWdtZW50KCkge1xuICAgIGlmKHRoaXMuX2F2Y0lkID09PSAtMSkge1xuICAgICAgLy9hdWRpbyBvbmx5XG4gICAgICBpZih0aGlzLl9hYWNUcmFjay5jb25maWcpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IHRoaXMuX2FhY1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogdGhpcy5fYWFjVHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9hYWNTYW1wbGVzWzBdLnB0cyAtIDkwMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgfVxuICAgIH0gZWxzZVxuICAgIGlmKHRoaXMuX2FhY0lkID09PSAtMSkge1xuICAgICAgLy92aWRlbyBvbmx5XG4gICAgICBpZih0aGlzLl9hdmNUcmFjay5zcHMgJiYgdGhpcy5fYXZjVHJhY2sucHBzKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQse1xuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICAgIHRoaXMuX2luaXREVFMgPSB0aGlzLl9hdmNTYW1wbGVzWzBdLmR0cyAtIDkwMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2F1ZGlvIGFuZCB2aWRlb1xuICAgICAgaWYodGhpcy5fYWFjVHJhY2suY29uZmlnICYmIHRoaXMuX2F2Y1RyYWNrLnNwcyAmJiB0aGlzLl9hdmNUcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IHRoaXMuX2FhY1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogdGhpcy5fYWFjVHJhY2suY2hhbm5lbENvdW50LFxuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IE1hdGgubWluKHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzLHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzKSAtIDkwMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gTWF0aC5taW4odGhpcy5fYXZjU2FtcGxlc1swXS5kdHMsdGhpcy5fYWFjU2FtcGxlc1swXS5kdHMpIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcbiIsIiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyICAgICAgICAgICAgZnJvbSAnLi4vZGVtdXgvdHNkZW11eGVyJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuXG5jbGFzcyBUU0RlbXV4ZXJXb3JrZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsZnVuY3Rpb24gKGV2KXtcbiAgICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBldi5kYXRhLmNtZCk7XG4gICAgICBzd2l0Y2goZXYuZGF0YS5jbWQpIHtcbiAgICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgICAgc2VsZi5kZW11eGVyID0gbmV3IFRTRGVtdXhlcigpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkdXJhdGlvbic6XG4gICAgICAgICAgc2VsZi5kZW11eGVyLnNldER1cmF0aW9uKGV2LmRhdGEuZGF0YSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3N3aXRjaExldmVsJzpcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIuc3dpdGNoTGV2ZWwoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZGVtdXgnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGV2LmRhdGEuZGF0YSksIGV2LmRhdGEuYXVkaW9Db2RlYyxldi5kYXRhLnZpZGVvQ29kZWMsIGV2LmRhdGEudGltZU9mZnNldCk7XG4gICAgICAgICAgc2VsZi5kZW11eGVyLmVuZCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gbGlzdGVuIHRvIGV2ZW50cyB0cmlnZ2VyZWQgYnkgVFMgRGVtdXhlclxuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIGZ1bmN0aW9uKGV2LGRhdGEpIHtcbiAgICAgIHZhciBvYmpEYXRhID0geyBldmVudCA6IGV2IH07XG4gICAgICB2YXIgb2JqVHJhbnNmZXJhYmxlID0gW107XG4gICAgICBpZihkYXRhLmF1ZGlvQ29kZWMpIHtcbiAgICAgICAgb2JqRGF0YS5hdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICBvYmpEYXRhLmF1ZGlvTW9vdiA9IGRhdGEuYXVkaW9Nb292LmJ1ZmZlcjtcbiAgICAgICAgb2JqRGF0YS5hdWRpb0NoYW5uZWxDb3VudCA9IGRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEuYXVkaW9Nb292KTtcbiAgICAgIH1cbiAgICAgIGlmKGRhdGEudmlkZW9Db2RlYykge1xuICAgICAgICBvYmpEYXRhLnZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgICAgIG9iakRhdGEudmlkZW9Nb292ID0gZGF0YS52aWRlb01vb3YuYnVmZmVyO1xuICAgICAgICBvYmpEYXRhLnZpZGVvV2lkdGggPSBkYXRhLnZpZGVvV2lkdGg7XG4gICAgICAgIG9iakRhdGEudmlkZW9IZWlnaHQgPSBkYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICBvYmpUcmFuc2ZlcmFibGUucHVzaChvYmpEYXRhLnZpZGVvTW9vdik7XG4gICAgICB9XG4gICAgICAvLyBwYXNzIG1vb3YgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSxvYmpUcmFuc2ZlcmFibGUpO1xuICAgIH0pO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCBmdW5jdGlvbihldixkYXRhKSB7XG4gICAgICB2YXIgb2JqRGF0YSA9IHsgZXZlbnQgOiBldiAsIHR5cGUgOiBkYXRhLnR5cGUsIHN0YXJ0UFRTIDogZGF0YS5zdGFydFBUUywgZW5kUFRTIDogZGF0YS5lbmRQVFMgLCBzdGFydERUUyA6IGRhdGEuc3RhcnREVFMsIGVuZERUUyA6IGRhdGEuZW5kRFRTICxtb29mIDogZGF0YS5tb29mLmJ1ZmZlciwgbWRhdCA6IGRhdGEubWRhdC5idWZmZXJ9O1xuICAgICAgLy8gcGFzcyBtb29mL21kYXQgZGF0YSBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLFtvYmpEYXRhLm1vb2Ysb2JqRGF0YS5tZGF0XSk7XG4gICAgfSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIGZ1bmN0aW9uKGV2KSB7XG4gICAgICB2YXIgb2JqRGF0YSA9IHsgZXZlbnQgOiBldiB9O1xuICAgICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXJXb3JrZXI7XG5cbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBzdWNjZXNmdWxseSBhdHRhY2hlZCB0byB2aWRlbyBlbGVtZW50IC0gZGF0YTogeyBtZWRpYVNvdXJjZSB9XG4gIE1TRV9BVFRBQ0hFRCA6ICdobHNNZWRpYVNvdXJjZUF0dGFjaGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gbG9hZGVkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIHVybCA6IG1hbmlmZXN0VVJMLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfX1cbiAgTUFOSUZFU1RfTE9BREVEICA6ICdobHNNYW5pZmVzdExvYWRlZCcsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIHBhcnNlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCBzdGFydExldmVsIDogcGxheWJhY2sgc3RhcnQgbGV2ZWwsIGF1ZGlvY29kZWNzd2l0Y2g6IHRydWUgaWYgZGlmZmVyZW50IGF1ZGlvIGNvZGVjcyB1c2VkfVxuICBNQU5JRkVTVF9QQVJTRUQgIDogJ2hsc01hbmlmZXN0UGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBsZXZlbElkIDogaWQgb2YgbGV2ZWwgYmVpbmcgbG9hZGVkfVxuICBMRVZFTF9MT0FESU5HICAgIDogJ2hsc0xldmVsTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIGZpbmlzaGVzIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWxJZCA6IGlkIG9mIGxvYWRlZCBsZXZlbCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX0gfVxuICBMRVZFTF9MT0FERUQgOiAgJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsSWQgOiBpZCBvZiBuZXcgbGV2ZWwgfVxuICBMRVZFTF9TV0lUQ0ggOiAgJ2hsc0xldmVsU3dpdGNoJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURJTkcgOiAgJ2hsc0ZyYWdtZW50TG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcGF5bG9hZCA6IGZyYWdtZW50IHBheWxvYWQsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbGVuZ3RofX1cbiAgRlJBR19MT0FERUQgOiAgJ2hsc0ZyYWdtZW50TG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBJbml0IFNlZ21lbnQgaGFzIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb3YgOiBtb292IE1QNCBib3gsIGNvZGVjcyA6IGNvZGVjcyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50fVxuICBGUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UIDogICdobHNGcmFnbWVudFBhcnNpbmdJbml0U2VnbWVudCcsXG4gIC8vIGZpcmVkIHdoZW4gbW9vZi9tZGF0IGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vZiA6IG1vb2YgTVA0IGJveCwgbWRhdCA6IG1kYXQgTVA0IGJveH1cbiAgRlJBR19QQVJTSU5HX0RBVEEgOiAgJ2hsc0ZyYWdtZW50UGFyc2luZ0RhdGEnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHBhcnNpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogdW5kZWZpbmVkXG4gIEZSQUdfUEFSU0VEIDogICdobHNGcmFnbWVudFBhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcmVtdXhlZCBNUDQgYm94ZXMgaGF2ZSBhbGwgYmVlbiBhcHBlbmRlZCBpbnRvIFNvdXJjZUJ1ZmZlciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCB0cGFyc2VkLCB0YnVmZmVyZWQsIGxlbmd0aH0gfVxuICBGUkFHX0JVRkZFUkVEIDogICdobHNGcmFnbWVudEJ1ZmZlcmVkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBtYXRjaGluZyB3aXRoIGN1cnJlbnQgdmlkZW8gcG9zaXRpb24gaXMgY2hhbmdpbmcgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19DSEFOR0VEIDogICdobHNGcmFnbWVudENoYW5nZWQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudC9wbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTE9BRF9FUlJPUiA6ICAnaGxzTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3IgLSBkYXRhOiB7IGxldmVsIDogZmF1bHR5IGxldmVsIElkLCBldmVudCA6IGVycm9yIGRlc2NyaXB0aW9ufVxuICBMRVZFTF9FUlJPUiA6ICAnaGxzTGV2ZWxFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgdmlkZW8gZXJyb3IgLSAgZGF0YTogdW5kZWZpbmVkXG4gIFZJREVPX0VSUk9SIDogICdobHNWaWRlb0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1IgOiAgJ2hsc0ZyYWdtZW50UGFyc2luZ0Vycm9yJ1xufTtcbiIsIi8qKlxuICogSExTIGVuZ2luZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi9vYnNlcnZlcic7XG5pbXBvcnQgUGxheWxpc3RMb2FkZXIgICAgICAgZnJvbSAnLi9sb2FkZXIvcGxheWxpc3QtbG9hZGVyJztcbmltcG9ydCBCdWZmZXJDb250cm9sbGVyICAgICBmcm9tICcuL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXInO1xuaW1wb3J0IExldmVsQ29udHJvbGxlciAgICAgIGZyb20gJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbmltcG9ydCB7bG9nZ2VyLGVuYWJsZUxvZ3N9ICBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG4vL2ltcG9ydCBNUDRJbnNwZWN0ICAgICAgICAgZnJvbSAnL3JlbXV4L21wNC1pbnNwZWN0b3InO1xuXG5jbGFzcyBIbHMge1xuXG4gIHN0YXRpYyBpc1N1cHBvcnRlZCgpIHtcbiAgICByZXR1cm4gKHdpbmRvdy5NZWRpYVNvdXJjZSAmJiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMucGxheWxpc3RMb2FkZXIpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG5ldyBCdWZmZXJDb250cm9sbGVyKHRoaXMubGV2ZWxDb250cm9sbGVyKTtcbiAgICB0aGlzLkV2ZW50cyA9IEV2ZW50O1xuICAgIHRoaXMuZGVidWcgPSBlbmFibGVMb2dzO1xuICAgIHRoaXMubG9nRXZ0ID0gdGhpcy5sb2dFdnQ7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lci5iaW5kKG9ic2VydmVyKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy5wbGF5bGlzdExvYWRlcikge1xuICAgICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy5idWZmZXJDb250cm9sbGVyKSB7XG4gICAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5idWZmZXJDb250cm9sbGVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy5sZXZlbENvbnRyb2xsZXIpIHtcbiAgICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubGV2ZWxDb250cm9sbGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51bmxvYWRTb3VyY2UoKTtcbiAgICB0aGlzLmRldGFjaFZpZGVvKCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hWaWRlbyh2aWRlbykge1xuICAgIHRoaXMudmlkZW8gPSB2aWRlbztcbiAgICAvLyBzZXR1cCB0aGUgbWVkaWEgc291cmNlXG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIC8vTWVkaWEgU291cmNlIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc28gPSB0aGlzLm9uTWVkaWFTb3VyY2VPcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NZWRpYVNvdXJjZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zYyA9IHRoaXMub25NZWRpYVNvdXJjZUNsb3NlLmJpbmQodGhpcyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgdmlkZW8uc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gICAgdGhpcy5vbnZlcnJvciA9IHRoaXMub25WaWRlb0Vycm9yLmJpbmQodGhpcyk7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLHRoaXMub252ZXJyb3IpO1xuICB9XG5cbiAgZGV0YWNoVmlkZW8oKSB7XG4gICAgdmFyIHZpZGVvID0gdGhpcy52aWRlbztcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmKG1zKSB7XG4gICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB2aWRlby5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIGlmKHZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICAgIC8vIHJlbW92ZSB2aWRlbyBlcnJvciBsaXN0ZW5lclxuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLHRoaXMub252ZXJyb3IpO1xuICAgICAgdGhpcy5vbnZlcnJvciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgbG9hZFNvdXJjZSh1cmwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICBsb2dnZXIubG9nKCdsb2FkU291cmNlOicrdXJsKTtcbiAgICAvLyB3aGVuIGF0dGFjaGluZyB0byBhIHNvdXJjZSBVUkwsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkXG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKHVybCxudWxsKTtcbiAgfVxuXG4gIHVubG9hZFNvdXJjZSgpIHtcbiAgICB0aGlzLnVybCA9IG51bGw7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgbmV4dCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBuZXh0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsICA9PT0gLTEpO1xuICB9XG5cbiAgLyogcmV0dXJuIG1hbnVhbCBsZXZlbCAqL1xuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NU0VfQVRUQUNIRUQsIHsgdmlkZW86IHRoaXMudmlkZW8sIG1lZGlhU291cmNlIDogdGhpcy5tZWRpYVNvdXJjZSB9KTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cblxuICBvblZpZGVvRXJyb3IoKSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5WSURFT19FUlJPUik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiIC8qXG4gKiBmcmFnbWVudCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbiBjbGFzcyBGcmFnbWVudExvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuYWJvcnQoKTtcbiAgICB0aGlzLnhociA9IG51bGw7XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICBpZih0aGlzLnhociAmJnRoaXMueGhyLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHRoaXMueGhyLmFib3J0KCk7XG4gICAgfVxuICB9XG5cbiAgbG9hZChmcmFnLGxldmVsSWQpIHtcbiAgICB0aGlzLmZyYWcgPSBmcmFnO1xuICAgIHRoaXMubGV2ZWxJZCA9IGxldmVsSWQ7XG4gICAgdGhpcy50cmVxdWVzdCA9IG5ldyBEYXRlKCk7XG4gICAgdGhpcy50Zmlyc3QgPSBudWxsO1xuICAgIHZhciB4aHIgPSB0aGlzLnhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhoci5vbmxvYWQ9ICB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9uZXJyb3IgPSB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpO1xuICAgIHhoci5vbnByb2dyZXNzID0gdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub3BlbignR0VUJywgZnJhZy51cmwgLCB0cnVlKTtcbiAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICB4aHIuc2VuZCgpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FESU5HLCB7IGZyYWcgOiBmcmFnfSk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBwYXlsb2FkID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICB7IHBheWxvYWQgOiBwYXlsb2FkLFxuICAgICAgICAgICAgICAgICAgICAgIGZyYWcgOiB0aGlzLmZyYWcgLFxuICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDoge3RyZXF1ZXN0IDogdGhpcy50cmVxdWVzdCwgdGZpcnN0IDogdGhpcy50Zmlyc3QsIHRsb2FkIDogbmV3IERhdGUoKSwgbGVuZ3RoIDpwYXlsb2FkLmJ5dGVMZW5ndGggfX0pO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmxvZygnZXJyb3IgbG9hZGluZyAnICsgdGhpcy5mcmFnLnVybCk7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX0VSUk9SLCB7IHVybCA6IHRoaXMuZnJhZy51cmwsIGV2ZW50OmV2ZW50fSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoKSB7XG4gICAgaWYodGhpcy50Zmlyc3QgPT09IG51bGwpIHtcbiAgICAgIHRoaXMudGZpcnN0ID0gbmV3IERhdGUoKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRnJhZ21lbnRMb2FkZXI7XG4iLCIvKlxuICogcGxheWxpc3QgbG9hZGVyXG4gKlxuICovXG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbi8vaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbiBjbGFzcyBQbGF5bGlzdExvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5tYW5pZmVzdExvYWRlZCA9IGZhbHNlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLnhociAmJnRoaXMueGhyLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHRoaXMueGhyLmFib3J0KCk7XG4gICAgICB0aGlzLnhociA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG4gIH1cblxuICBsb2FkKHVybCxyZXF1ZXN0SWQpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLmlkID0gcmVxdWVzdElkO1xuICAgIHRoaXMuc3RhdHMgPSB7IHRyZXF1ZXN0IDogbmV3IERhdGUoKX07XG4gICAgdmFyIHhociA9IHRoaXMueGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9ubG9hZD0gIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub25lcnJvciA9IHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICAgIHhoci5zZW5kKCk7XG4gIH1cblxuICByZXNvbHZlKHVybCwgYmFzZVVybCkge1xuICAgIHZhciBkb2MgICAgICA9IGRvY3VtZW50LFxuICAgICAgICBvbGRCYXNlID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdiYXNlJylbMF0sXG4gICAgICAgIG9sZEhyZWYgPSBvbGRCYXNlICYmIG9sZEJhc2UuaHJlZixcbiAgICAgICAgZG9jSGVhZCA9IGRvYy5oZWFkIHx8IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdLFxuICAgICAgICBvdXJCYXNlID0gb2xkQmFzZSB8fCBkb2NIZWFkLmFwcGVuZENoaWxkKGRvYy5jcmVhdGVFbGVtZW50KCdiYXNlJykpLFxuICAgICAgICByZXNvbHZlciA9IGRvYy5jcmVhdGVFbGVtZW50KCdhJyksXG4gICAgICAgIHJlc29sdmVkVXJsO1xuXG4gICAgb3VyQmFzZS5ocmVmID0gYmFzZVVybDtcbiAgICByZXNvbHZlci5ocmVmID0gdXJsO1xuICAgIHJlc29sdmVkVXJsICA9IHJlc29sdmVyLmhyZWY7IC8vIGJyb3dzZXIgbWFnaWMgYXQgd29yayBoZXJlXG5cbiAgICBpZiAob2xkQmFzZSkge29sZEJhc2UuaHJlZiA9IG9sZEhyZWY7fVxuICAgIGVsc2Uge2RvY0hlYWQucmVtb3ZlQ2hpbGQob3VyQmFzZSk7fVxuICAgIHJldHVybiByZXNvbHZlZFVybDtcbiAgfVxuXG4gIHBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLGJhc2V1cmwpIHtcbiAgICB2YXIgbGV2ZWxzID0gW10sbGV2ZWwgPSAge30scmVzdWx0LGNvZGVjcyxjb2RlYztcbiAgICB2YXIgcmUgPSAvI0VYVC1YLVNUUkVBTS1JTkY6KFteXFxuXFxyXSooQkFORClXSURUSD0oXFxkKykpPyhbXlxcblxccl0qKENPREVDUyk9XFxcIiguKilcXFwiLCk/KFteXFxuXFxyXSooUkVTKU9MVVRJT049KFxcZCspeChcXGQrKSk/KFteXFxuXFxyXSooTkFNRSk9XFxcIiguKilcXFwiKT9bXlxcblxccl0qW1xcclxcbl0rKFteXFxyXFxuXSspL2c7XG4gICAgd2hpbGUoKHJlc3VsdCA9IHJlLmV4ZWMoc3RyaW5nKSkgIT0gbnVsbCl7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obil7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTt9KTtcbiAgICAgIGxldmVsLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHQucG9wKCksYmFzZXVybCk7XG4gICAgICB3aGlsZShyZXN1bHQubGVuZ3RoID4gMCkge1xuICAgICAgICBzd2l0Y2gocmVzdWx0LnNoaWZ0KCkpIHtcbiAgICAgICAgICBjYXNlICdSRVMnOlxuICAgICAgICAgICAgbGV2ZWwud2lkdGggPSBwYXJzZUludChyZXN1bHQuc2hpZnQoKSk7XG4gICAgICAgICAgICBsZXZlbC5oZWlnaHQgPSBwYXJzZUludChyZXN1bHQuc2hpZnQoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdCQU5EJzpcbiAgICAgICAgICAgIGxldmVsLmJpdHJhdGUgPSBwYXJzZUludChyZXN1bHQuc2hpZnQoKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdOQU1FJzpcbiAgICAgICAgICAgIGxldmVsLm5hbWUgPSByZXN1bHQuc2hpZnQoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0NPREVDUyc6XG4gICAgICAgICAgICBjb2RlY3MgPSByZXN1bHQuc2hpZnQoKS5zcGxpdCgnLCcpO1xuICAgICAgICAgICAgd2hpbGUoY29kZWNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgY29kZWMgPSBjb2RlY3Muc2hpZnQoKTtcbiAgICAgICAgICAgICAgaWYoY29kZWMuaW5kZXhPZignYXZjMScpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGxldmVsLnZpZGVvQ29kZWMgPSB0aGlzLmF2YzF0b2F2Y290aShjb2RlYyk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwuYXVkaW9Db2RlYyA9IGNvZGVjO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgIGxldmVsID0ge307XG4gICAgfVxuICAgIHJldHVybiBsZXZlbHM7XG4gIH1cblxuICBhdmMxdG9hdmNvdGkoY29kZWMpIHtcbiAgICB2YXIgcmVzdWx0LGF2Y2RhdGEgPSBjb2RlYy5zcGxpdCgnLicpO1xuICAgIGlmKGF2Y2RhdGEubGVuZ3RoID4gMikge1xuICAgICAgcmVzdWx0ID0gYXZjZGF0YS5zaGlmdCgpICsgJy4nO1xuICAgICAgcmVzdWx0ICs9IHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpO1xuICAgICAgcmVzdWx0ICs9ICgnMDAnICsgcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNikpLnN1YnN0cigtNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGNvZGVjO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgYmFzZXVybCwgaWQpIHtcbiAgICB2YXIgY3VycmVudFNOID0gMCx0b3RhbGR1cmF0aW9uID0gMCwgbGV2ZWwgPSB7IHVybCA6IGJhc2V1cmwsIGZyYWdtZW50cyA6IFtdLCBsaXZlIDogdHJ1ZX0sIHJlc3VsdCwgcmVnZXhwO1xuICAgIHJlZ2V4cCA9IC8oPzojRVhULVgtKE1FRElBLVNFUVVFTkNFKTooXFxkKykpfCg/OiNFWFQtWC0oVEFSR0VURFVSQVRJT04pOihcXGQrKSl8KD86I0VYVChJTkYpOihbXFxkXFwuXSspW15cXHJcXG5dKltcXHJcXG5dKyhbXlxcclxcbl0rKXwoPzojRVhULVgtKEVORExJU1QpKSkvZztcbiAgICB3aGlsZSgocmVzdWx0ID0gcmVnZXhwLmV4ZWMoc3RyaW5nKSkgIT09IG51bGwpe1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4peyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7fSk7XG4gICAgICBzd2l0Y2gocmVzdWx0WzBdKSB7XG4gICAgICAgIGNhc2UgJ01FRElBLVNFUVVFTkNFJzpcbiAgICAgICAgICBjdXJyZW50U04gPSBsZXZlbC5zdGFydFNOID0gcGFyc2VJbnQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnVEFSR0VURFVSQVRJT04nOlxuICAgICAgICAgIGxldmVsLnRhcmdldGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFTkRMSVNUJzpcbiAgICAgICAgICBsZXZlbC5saXZlID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0lORic6XG4gICAgICAgICAgdmFyIGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGxldmVsLmZyYWdtZW50cy5wdXNoKHt1cmwgOiB0aGlzLnJlc29sdmUocmVzdWx0WzJdLGJhc2V1cmwpLCBkdXJhdGlvbiA6IGR1cmF0aW9uLCBzdGFydCA6IHRvdGFsZHVyYXRpb24sIHNuIDogY3VycmVudFNOKyssIGxldmVsOmlkfSk7XG4gICAgICAgICAgdG90YWxkdXJhdGlvbis9ZHVyYXRpb247XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZm91bmQgJyArIGxldmVsLmZyYWdtZW50cy5sZW5ndGggKyAnIGZyYWdtZW50cycpO1xuICAgIGxldmVsLnRvdGFsZHVyYXRpb24gPSB0b3RhbGR1cmF0aW9uO1xuICAgIGxldmVsLmVuZFNOID0gY3VycmVudFNOIC0gMTtcbiAgICByZXR1cm4gbGV2ZWw7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBkYXRhLHN0cmluZyA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VUZXh0LCB1cmwgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlVVJMLCBpZCA9IHRoaXMuaWQ7XG4gICAgLy8gcmVzcG9uc2VVUkwgbm90IHN1cHBvcnRlZCBvbiBzb21lIGJyb3dzZXJzIChpdCBpcyB1c2VkIHRvIGRldGVjdCBVUkwgcmVkaXJlY3Rpb24pXG4gICAgaWYodXJsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGZhbGxiYWNrIHRvIGluaXRpYWwgVVJMXG4gICAgICB1cmwgPSB0aGlzLnVybDtcbiAgICB9XG4gICAgdGhpcy5zdGF0cy50bG9hZCA9IG5ldyBEYXRlKCk7XG4gICAgdGhpcy5zdGF0cy5tdGltZSA9IG5ldyBEYXRlKHRoaXMueGhyLmdldFJlc3BvbnNlSGVhZGVyKCdMYXN0LU1vZGlmaWVkJykpO1xuXG4gICAgaWYoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0LCBwYXJzZSBpdFxuICAgICAgICBkYXRhID0gdGhpcy5wYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLHVybCxpZCk7XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50IGJlZm9yZWhhbmRcbiAgICAgICAgaWYodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxldmVscyA6IFtkYXRhXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiB1cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiB0aGlzLnN0YXRzfSk7XG4gICAgICAgIH1cbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGRldGFpbHMgOiBkYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbElkIDogaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogdGhpcy5zdGF0c30pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbXVsdGkgbGV2ZWwgcGxheWxpc3QsIHBhcnNlIGxldmVsIGluZm9cbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGxldmVscyA6IHRoaXMucGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsdXJsKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsIDogdXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBpZCA6IGlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHRoaXMuc3RhdHN9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX0VSUk9SLCB7IHVybCA6IHVybCwgcmVzcG9uc2UgOiBldmVudC5jdXJyZW50VGFyZ2V0fSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX0VSUk9SLCB7IHVybCA6IHRoaXMudXJsLCByZXNwb25zZSA6IGV2ZW50LmN1cnJlbnRUYXJnZXR9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcbiAgICBpZih0aGlzLnN0YXRzLnRmaXJzdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnN0YXRzLnRmaXJzdCA9IG5ldyBEYXRlKCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBsYXlsaXN0TG9hZGVyO1xuIiwiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuXG5sZXQgb2JzZXJ2ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5cbm9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBvYnNlcnZlcjtcbiIsIi8qKlxuICogZ2VuZXJhdGUgTVA0IEJveFxuICovXG5cbmNsYXNzIE1QNCB7XG4gIHN0YXRpYyBpbml0KCkge1xuICAgIE1QNC50eXBlcyA9IHtcbiAgICAgIGF2YzE6IFtdLCAvLyBjb2RpbmduYW1lXG4gICAgICBhdmNDOiBbXSxcbiAgICAgIGJ0cnQ6IFtdLFxuICAgICAgZGluZjogW10sXG4gICAgICBkcmVmOiBbXSxcbiAgICAgIGVzZHM6IFtdLFxuICAgICAgZnR5cDogW10sXG4gICAgICBoZGxyOiBbXSxcbiAgICAgIG1kYXQ6IFtdLFxuICAgICAgbWRoZDogW10sXG4gICAgICBtZGlhOiBbXSxcbiAgICAgIG1maGQ6IFtdLFxuICAgICAgbWluZjogW10sXG4gICAgICBtb29mOiBbXSxcbiAgICAgIG1vb3Y6IFtdLFxuICAgICAgbXA0YTogW10sXG4gICAgICBtdmV4OiBbXSxcbiAgICAgIG12aGQ6IFtdLFxuICAgICAgc2R0cDogW10sXG4gICAgICBzdGJsOiBbXSxcbiAgICAgIHN0Y286IFtdLFxuICAgICAgc3RzYzogW10sXG4gICAgICBzdHNkOiBbXSxcbiAgICAgIHN0c3o6IFtdLFxuICAgICAgc3R0czogW10sXG4gICAgICB0ZmR0OiBbXSxcbiAgICAgIHRmaGQ6IFtdLFxuICAgICAgdHJhZjogW10sXG4gICAgICB0cmFrOiBbXSxcbiAgICAgIHRydW46IFtdLFxuICAgICAgdHJleDogW10sXG4gICAgICB0a2hkOiBbXSxcbiAgICAgIHZtaGQ6IFtdLFxuICAgICAgc21oZDogW11cbiAgICB9O1xuXG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIE1QNC50eXBlcykge1xuICAgICAgaWYgKE1QNC50eXBlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBNUDQudHlwZXNbaV0gPSBbXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDApLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgxKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMiksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDMpXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgTVA0Lk1BSk9SX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2knLmNoYXJDb2RlQXQoMCksXG4gICAgICAncycuY2hhckNvZGVBdCgwKSxcbiAgICAgICdvJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ20nLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuQVZDMV9CUkFORCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICdhJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ3YnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnYycuY2hhckNvZGVBdCgwKSxcbiAgICAgICcxJy5jaGFyQ29kZUF0KDApXG4gICAgXSk7XG4gICAgTVA0Lk1JTk9SX1ZFUlNJT04gPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMV0pO1xuICAgIE1QNC5WSURFT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuQVVESU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOk1QNC5WSURFT19IRExSLFxuICAgICAgJ2F1ZGlvJzpNUDQuQVVESU9fSERMUlxuICAgIH07XG4gICAgTVA0LkRSRUYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG4gICAgTVA0LlNUQ08gPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCAvLyBlbnRyeV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5TVFNDID0gTVA0LlNUQ087XG4gICAgTVA0LlNUVFMgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIE1QNC5NQUpPUl9CUkFORCwgTVA0Lk1JTk9SX1ZFUlNJT04sIE1QNC5NQUpPUl9CUkFORCwgTVA0LkFWQzFfQlJBTkQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgTVA0LkRSRUYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gMCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgcmVzdWx0LFxuICAgIHZpZXc7XG5cbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShzaXplICsgOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhyZXN1bHQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLCByZXN1bHQuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcblxuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBwYXlsb2FkLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZChkdXJhdGlvbikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAzLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMSwgMHg1ZiwgMHg5MCwgLy8gdGltZXNjYWxlLCA5MCwwMDAgXCJ0aWNrc1wiIHBlciBzZWNvbmRcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMjQpLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gIDgpICYgMHhGRixcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnNtaGQsIE1QNC5TTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy52bWhkLCBNUDQuVk1IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBtb29mKHNuLCBiYXNlTWVkaWFEZWNvZGVUaW1lLCB0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tb29mLFxuICAgICAgICAgICAgICAgICAgIE1QNC5tZmhkKHNuKSxcbiAgICAgICAgICAgICAgICAgICBNUDQudHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSk7XG4gIH1cbi8qKlxuICogQHBhcmFtIHRyYWNrcy4uLiAob3B0aW9uYWwpIHthcnJheX0gdGhlIHRyYWNrcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBtb3ZpZVxuICovXG4gIHN0YXRpYyBtb292KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJhayh0cmFja3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubW9vdiwgTVA0Lm12aGQodHJhY2tzWzBdLmR1cmF0aW9uKV0uY29uY2F0KGJveGVzKS5jb25jYXQoTVA0Lm12ZXgodHJhY2tzKSkpO1xuICB9XG5cbiAgc3RhdGljIG12ZXgodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmV4KHRyYWNrc1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubXZleF0uY29uY2F0KGJveGVzKSk7XG4gIH1cblxuICBzdGF0aWMgbXZoZChkdXJhdGlvbikge1xuICAgIHZhclxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4NWYsIDB4OTAsIC8vIHRpbWVzY2FsZSwgOTAsMDAwIFwidGlja3NcIiBwZXIgc2Vjb25kXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLCAvLyAxLjAgcmF0ZVxuICAgICAgICAweDAxLCAweDAwLCAvLyAxLjAgdm9sdW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHhmZiwgMHhmZiwgMHhmZiwgMHhmZiAvLyBuZXh0X3RyYWNrX0lEXG4gICAgICBdKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXZoZCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHNkdHAodHJhY2spIHtcbiAgICB2YXJcbiAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheSg0ICsgc2FtcGxlcy5sZW5ndGgpLFxuICAgICAgZmxhZ3MsXG4gICAgICBpO1xuXG4gICAgLy8gbGVhdmUgdGhlIGZ1bGwgYm94IGhlYWRlciAoNCBieXRlcykgYWxsIHplcm9cblxuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzW2ldLmZsYWdzO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKGZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsXG4gICAgICAgICAgICAgICBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc3RibCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdGJsLFxuICAgICAgICAgICAgICAgTVA0LnN0c2QodHJhY2spLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RzYywgTVA0LlNUU0MpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RzeiwgTVA0LlNUU1opLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaTtcbiAgICAvLyBhc3NlbWJsZSB0aGUgU1BTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5zcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNwcy5wdXNoKCh0cmFjay5zcHNbaV0uYnl0ZUxlbmd0aCA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHNwcy5wdXNoKCh0cmFjay5zcHNbaV0uYnl0ZUxlbmd0aCAmIDB4RkYpKTsgLy8gc2VxdWVuY2VQYXJhbWV0ZXJTZXRMZW5ndGhcbiAgICAgIHNwcyA9IHNwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodHJhY2suc3BzW2ldKSk7IC8vIFNQU1xuICAgIH1cblxuICAgIC8vIGFzc2VtYmxlIHRoZSBQUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnBwcy5sZW5ndGg7IGkrKykge1xuICAgICAgcHBzLnB1c2goKHRyYWNrLnBwc1tpXS5ieXRlTGVuZ3RoID4+PiA4KSAmIDB4RkYpO1xuICAgICAgcHBzLnB1c2goKHRyYWNrLnBwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpO1xuICAgICAgcHBzID0gcHBzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5wcHNbaV0pKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuYXZjMSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAodHJhY2sud2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgICB0cmFjay53aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAgICh0cmFjay5oZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgICB0cmFjay5oZWlnaHQgJiAweGZmLCAvLyBoZWlnaHRcbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gaG9yaXpyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGZyYW1lX2NvdW50XG4gICAgICAgIDB4MTMsXG4gICAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAgIDB4NmYsIDB4NmEsIDB4NzMsIDB4MmQsXG4gICAgICAgIDB4NjMsIDB4NmYsIDB4NmUsIDB4NzQsXG4gICAgICAgIDB4NzIsIDB4NjksIDB4NjIsIDB4MmQsXG4gICAgICAgIDB4NjgsIDB4NmMsIDB4NzMsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNvbXByZXNzb3JuYW1lXG4gICAgICAgIDB4MDAsIDB4MTgsIC8vIGRlcHRoID0gMjRcbiAgICAgICAgMHgxMSwgMHgxMV0pLCAvLyBwcmVfZGVmaW5lZCA9IC0xXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYXZjQywgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMSwgLy8gY29uZmlndXJhdGlvblZlcnNpb25cbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVJZGMsIC8vIEFWQ1Byb2ZpbGVJbmRpY2F0aW9uXG4gICAgICAgICAgICB0cmFjay5wcm9maWxlQ29tcGF0aWJpbGl0eSwgLy8gcHJvZmlsZV9jb21wYXRpYmlsaXR5XG4gICAgICAgICAgICB0cmFjay5sZXZlbElkYywgLy8gQVZDTGV2ZWxJbmRpY2F0aW9uXG4gICAgICAgICAgICAweGZmIC8vIGxlbmd0aFNpemVNaW51c09uZSwgaGFyZC1jb2RlZCB0byA0IGJ5dGVzXG4gICAgICAgICAgXS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2suc3BzLmxlbmd0aCAvLyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChzcHMpLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5wcHMubGVuZ3RoIC8vIG51bU9mUGljdHVyZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQocHBzKSkpLCAvLyBcIlBQU1wiXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrdHJhY2suY29uZmlnLmxlbmd0aCwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK3RyYWNrLmNvbmZpZy5sZW5ndGgsIC8vIGxlbmd0aFxuICAgICAgMHg0MCwgLy9jb2RlYyA6IG1wZWc0X2F1ZGlvXG4gICAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYnVmZmVyX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1heEJpdHJhdGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgICAgMHgwNSAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIF0uY29uY2F0KFt0cmFjay5jb25maWcubGVuZ3RoXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgICAgKHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQubXA0YSh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQuYXZjMSh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB0a2hkKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRraGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwNywgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodHJhY2suaWQgPj4gMjQpICYgMHhGRixcbiAgICAgICh0cmFjay5pZCA+PiAxNikgJiAweEZGLFxuICAgICAgKHRyYWNrLmlkID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmlkICYgMHhGRiwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbGF5ZXJcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGFsdGVybmF0ZV9ncm91cFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbm9uLWF1ZGlvIHRyYWNrIHZvbHVtZVxuICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgKHRyYWNrLndpZHRoID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLndpZHRoICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHdpZHRoXG4gICAgICAodHJhY2suaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgIHRyYWNrLmhlaWdodCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwIC8vIGhlaWdodFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpIHtcbiAgICB2YXIgc2FtcGxlRGVwZW5kZW5jeVRhYmxlID0gTVA0LnNkdHAodHJhY2spO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFmLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDI0KSxcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYpIC8vIHRyYWNrX0lEXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmR0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PjI0KSxcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYpIC8vIGJhc2VNZWRpYURlY29kZVRpbWVcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC50cnVuKHRyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmhkXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZkdFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIHRyYWYgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gbWZoZFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIG1vb2YgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDgpLCAgLy8gbWRhdCBoZWFkZXJcbiAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZSk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSB0cmFjayBib3guXG4gICAqIEBwYXJhbSB0cmFjayB7b2JqZWN0fSBhIHRyYWNrIGRlZmluaXRpb25cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIHRyYWNrIGJveFxuICAgKi9cbiAgc3RhdGljIHRyYWsodHJhY2spIHtcbiAgICB0cmFjay5kdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uIHx8IDB4ZmZmZmZmZmY7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWssXG4gICAgICAgICAgICAgICBNUDQudGtoZCh0cmFjayksXG4gICAgICAgICAgICAgICBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAodHJhY2suaWQgPj4gMjQpLFxuICAgICAodHJhY2suaWQgPj4gMTYpICYgMFhGRixcbiAgICAgKHRyYWNrLmlkID4+IDgpICYgMFhGRixcbiAgICAgKHRyYWNrLmlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIHNhbXBsZXMsIHNhbXBsZSwgaSwgYXJyYXk7XG5cbiAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXTtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KDEyICsgKDE2ICogc2FtcGxlcy5sZW5ndGgpKTtcbiAgICBvZmZzZXQgKz0gOCArIGFycmF5LmJ5dGVMZW5ndGg7XG5cbiAgICBhcnJheS5zZXQoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDBmLCAweDAxLCAvLyBmbGFnc1xuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiAyNCkgJiAweEZGLFxuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiAxNikgJiAweEZGLFxuICAgICAgKHNhbXBsZXMubGVuZ3RoID4+PiA4KSAmIDB4RkYsXG4gICAgICBzYW1wbGVzLmxlbmd0aCAmIDB4RkYsIC8vIHNhbXBsZV9jb3VudFxuICAgICAgKG9mZnNldCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiA4KSAmIDB4RkYsXG4gICAgICBvZmZzZXQgJiAweEZGIC8vIGRhdGFfb2Zmc2V0XG4gICAgXSwwKTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzYW1wbGUgPSBzYW1wbGVzW2ldO1xuICAgICAgYXJyYXkuc2V0KFtcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuZHVyYXRpb24gJiAweEZGLCAvLyBzYW1wbGVfZHVyYXRpb25cbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuc2l6ZSAmIDB4RkYsIC8vIHNhbXBsZV9zaXplXG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgc2FtcGxlLmZsYWdzLmRlcGVuZHNPbixcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAgIChzYW1wbGUuZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKHNhbXBsZS5mbGFncy5wYWRkaW5nVmFsdWUgPDwgMSkgfFxuICAgICAgICAgIHNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUsXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRhdGlvblByaW9yaXR5ICYgMHhGMCA8PCA4LFxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkYXRpb25Qcmlvcml0eSAmIDB4MEYsIC8vIHNhbXBsZV9mbGFnc1xuICAgICAgICAoc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgICAgXSwxMisxNippKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRydW4sIGFycmF5KTtcbiAgfVxuXG4gIHN0YXRpYyBpbml0U2VnbWVudCh0cmFja3MpIHtcblxuICAgIGlmKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhclxuICAgICAgbW92aWUgPSBNUDQubW9vdih0cmFja3MpLFxuICAgICAgcmVzdWx0O1xuXG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoTVA0LkZUWVAuYnl0ZUxlbmd0aCArIG1vdmllLmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQoTVA0LkZUWVApO1xuICAgIHJlc3VsdC5zZXQobW92aWUsIE1QNC5GVFlQLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuXG5cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCgpe31cbmxldCBmYWtlTG9nZ2VyID0ge1xuICBsb2c6IG5vb3AsXG4gIHdhcm46IG5vb3AsXG4gIGluZm86IG5vb3AsXG4gIGVycm9yOiBub29wXG59O1xubGV0IGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcblxuZXhwb3J0IHZhciBlbmFibGVMb2dzID0gZnVuY3Rpb24oZGVidWcpIHtcbiAgaWYgKGRlYnVnID09PSB0cnVlIHx8IHR5cGVvZiBkZWJ1ZyAgICAgICA9PT0gJ29iamVjdCcpIHtcbiAgICBleHBvcnRlZExvZ2dlci5sb2cgICA9IGRlYnVnLmxvZyAgID8gZGVidWcubG9nLmJpbmQoZGVidWcpICAgOiBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLmluZm8gID0gZGVidWcuaW5mbyAgPyBkZWJ1Zy5pbmZvLmJpbmQoZGVidWcpICA6IGNvbnNvbGUuaW5mby5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLmVycm9yID0gZGVidWcuZXJyb3IgPyBkZWJ1Zy5lcnJvci5iaW5kKGRlYnVnKSA6IGNvbnNvbGUuZXJyb3IuYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci53YXJuICA9IGRlYnVnLndhcm4gID8gZGVidWcud2Fybi5iaW5kKGRlYnVnKSAgOiBjb25zb2xlLndhcm4uYmluZChjb25zb2xlKTtcblxuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG9uJ3QgYWxsb3cgdG8gdXNlIGJpbmQgb24gY29uc29sZSBvYmplY3QgYW55d2F5XG4gICAgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICBleHBvcnRlZExvZ2dlci5sb2coKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyAgID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmluZm8gID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmVycm9yID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gID0gbm9vcDtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICB9XG59O1xuZXhwb3J0IHZhciBsb2dnZXIgPSBleHBvcnRlZExvZ2dlcjtcbiJdfQ==
